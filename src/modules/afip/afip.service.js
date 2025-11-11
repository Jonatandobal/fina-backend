// src/modules/afip/afip.service.js
const supabase = require('../../config/supabase');
const { createAfipInstance, cleanupTempCerts } = require('../../config/afip');
const { getRedisClient } = require('../../config/redis');
const { AppError } = require('../../shared/middlewares/errorHandler');
const logger = require('../../shared/utils/logger');

class AfipService {
  /**
   * Validar CUIT contra Padrón AFIP A5
   */
  async validateCuit(userId, cuit) {
    try {
      const { data: certData, error: certError } = await supabase
        .rpc('get_user_afip_cert', { p_user_id: userId });

      if (certError || !certData || certData.length === 0) {
        throw new AppError(
          'No se encontraron certificados AFIP configurados',
          404,
          'Debe configurar sus certificados AFIP primero'
        );
      }

      const cert = certData[0];
      const afip = await createAfipInstance(cert);

      const redis = getRedisClient();
      const cacheKey = `afip:padron:${cuit}`;

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info(`Cache hit for CUIT: ${cuit}`);
          return JSON.parse(cached);
        }
      }

      logger.info(`Consulting AFIP Padron for CUIT: ${cuit}`);
      const padronData = await afip.RegisterScopeFour.getTaxpayerDetails(cuit);

      const result = {
        cuit,
        razon_social: padronData.nombre || 'N/A',
        condicion_iva: this.mapCondicionIVA(padronData.idPersona),
        domicilio_fiscal: padronData.domicilio?.[0]?.direccion || null,
        actividades: padronData.actividad || [],
        activo: padronData.estadoClave === 'ACTIVO',
        fecha_consulta: new Date().toISOString()
      };

      if (redis) {
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
      }

      await supabase.rpc('upsert_cliente_desde_padron', {
        p_user_id: userId,
        p_cuit: cuit,
        p_razon_social: result.razon_social,
        p_condicion_iva: result.condicion_iva,
        p_domicilio_fiscal: result.domicilio_fiscal
      });

      await cleanupTempCerts(cert.cuit);

      return result;
    } catch (error) {
      logger.error('Error validating CUIT:', error);

      if (error.isOperational) {
        throw error;
      }

      throw new AppError(
        'Error al consultar AFIP',
        500,
        error.message
      );
    }
  }

  /**
   * Crear factura electrónica en AFIP
   */
  async createInvoice(userId, invoiceData) {
    try {
      const {
        cuit_cliente,
        tipo_factura, // 'A', 'B', 'C'
        punto_venta,
        concepto = 'Productos', // 'Productos', 'Servicios', 'Productos y Servicios'
        monto_neto,
        monto_iva,
        items = [],
        fecha_vencimiento_pago = null,
        observaciones = null
      } = invoiceData;

      // 1. Validar datos
      this.validateInvoiceData(invoiceData);

      // 2. Obtener certificados del usuario
      const { data: certData } = await supabase
        .rpc('get_user_afip_cert', { p_user_id: userId });

      if (!certData || certData.length === 0) {
        throw new AppError('No se encontraron certificados AFIP', 404);
      }

      const cert = certData[0];

      // 3. Validar CUIT del cliente
      const clientData = await this.validateCuit(userId, cuit_cliente);

      // 4. Determinar tipo de factura según condición IVA
      const tipoFacturaFinal = this.determinarTipoFactura(
        tipo_factura,
        clientData.condicion_iva
      );

      // 5. Crear instancia de AFIP
      const afip = await createAfipInstance(cert);

      // 6. Obtener último número de comprobante
      const codigoAfip = this.getTipoComprobanteCode(tipoFacturaFinal);
      const ultimoNumero = await afip.ElectronicBilling.getLastVoucher(
        parseInt(punto_venta),
        codigoAfip
      );

      const nuevoNumero = ultimoNumero + 1;

      // 7. Calcular totales
      const totales = this.calcularTotales(
        monto_neto,
        monto_iva,
        tipoFacturaFinal
      );

      // 8. Preparar datos para AFIP
      const fechaActual = new Date();
      const invoiceParams = {
        CantReg: 1,
        PtoVta: parseInt(punto_venta),
        CbteTipo: codigoAfip,
        Concepto: this.getConceptoCode(concepto),
        DocTipo: 80, // CUIT
        DocNro: parseInt(cuit_cliente),
        CbteDesde: nuevoNumero,
        CbteHasta: nuevoNumero,
        CbteFch: this.formatDate(fechaActual),
        ImpTotal: totales.total,
        ImpTotConc: 0, // No gravado
        ImpNeto: totales.neto,
        ImpOpEx: 0, // Exento
        ImpIVA: totales.iva,
        ImpTrib: 0, // Otros tributos
        MonId: 'PES',
        MonCotiz: 1
      };

      // 9. Agregar IVA si corresponde
      if (tipoFacturaFinal === 'A' && totales.iva > 0) {
        invoiceParams.Iva = [
          {
            Id: 5, // 21%
            BaseImp: totales.neto,
            Importe: totales.iva
          }
        ];
      }

      // 10. Emitir factura en AFIP
      logger.info(`Creating invoice in AFIP for user: ${userId}`);
      const afipResponse = await afip.ElectronicBilling.createVoucher(invoiceParams);

      // 11. Extraer CAE
      const cae = afipResponse.CAE;
      const fechaVtoCae = afipResponse.CAEFchVto;

      if (!cae) {
        throw new AppError(
          'AFIP no devolvió CAE',
          500,
          afipResponse.Observaciones || 'Error desconocido'
        );
      }

      // 12. Guardar en Supabase
      const { data: facturaGuardada } = await supabase.rpc('guardar_factura_afip', {
        p_user_id: userId,
        p_tipo: tipoFacturaFinal,
        p_codigo_afip: codigoAfip,
        p_punto_venta: parseInt(punto_venta),
        p_numero: nuevoNumero,
        p_cae: cae,
        p_fecha_vto_cae: this.parseAfipDate(fechaVtoCae),
        p_cuit_cliente: cuit_cliente,
        p_razon_social: clientData.razon_social,
        p_monto_neto: totales.neto,
        p_monto_iva: totales.iva,
        p_monto_total: totales.total,
        p_concepto: observaciones || concepto,
        p_fecha_venc_pago: fecha_vencimiento_pago,
        p_pdf_url: null // Se genera después
      });

      // 13. Cleanup
      await cleanupTempCerts(cert.cuit);

      // 14. Retornar resultado
      const numeroCompleto = `${String(punto_venta).padStart(5, '0')}-${String(nuevoNumero).padStart(8, '0')}`;

      return {
        success: true,
        factura: {
          tipo: tipoFacturaFinal,
          numero: numeroCompleto,
          punto_venta: punto_venta,
          numero_factura: nuevoNumero,
          cae: cae,
          fecha_vto_cae: fechaVtoCae,
          cliente: {
            cuit: cuit_cliente,
            razon_social: clientData.razon_social,
            condicion_iva: clientData.condicion_iva
          },
          importes: {
            neto: totales.neto,
            iva: totales.iva,
            total: totales.total
          },
          fecha_emision: fechaActual.toISOString(),
          comprobante_id: facturaGuardada.comprobante_id
        }
      };
    } catch (error) {
      logger.error('Error creating invoice:', error);

      if (error.isOperational) {
        throw error;
      }

      throw new AppError(
        'Error al crear factura en AFIP',
        500,
        error.message
      );
    }
  }

  /**
   * Crear nota de crédito
   */
  async createCreditNote(userId, creditNoteData) {
    try {
      const {
        factura_original_id,
        motivo = 'Anulación de factura'
      } = creditNoteData;

      // 1. Obtener factura original
      const { data: facturaOriginal, error } = await supabase
        .from('comprobantes_oficiales')
        .select('*')
        .eq('id', factura_original_id)
        .eq('user_id', userId)
        .single();

      if (error || !facturaOriginal) {
        throw new AppError('Factura original no encontrada', 404);
      }

      if (facturaOriginal.anulada) {
        throw new AppError('La factura ya está anulada', 400);
      }

      // 2. Crear NC con los mismos datos pero monto negativo
      const ncData = {
        cuit_cliente: facturaOriginal.contraparte_cuit,
        tipo_factura: facturaOriginal.tipo.replace('factura_', '').toUpperCase(),
        punto_venta: parseInt(facturaOriginal.punto_venta),
        concepto: motivo,
        monto_neto: facturaOriginal.neto,
        monto_iva: facturaOriginal.iva_monto,
        observaciones: `NC por factura ${facturaOriginal.comprobante_completo}. ${motivo}`
      };

      // 3. Obtener certificados
      const { data: certData } = await supabase
        .rpc('get_user_afip_cert', { p_user_id: userId });

      if (!certData || certData.length === 0) {
        throw new AppError('No se encontraron certificados AFIP', 404);
      }

      const cert = certData[0];
      const afip = await createAfipInstance(cert);

      // 4. Código de NC (3 para A, 8 para B, 13 para C)
      const codigoNC = this.getNotaCreditoCode(ncData.tipo_factura);

      // 5. Obtener último número
      const ultimoNumero = await afip.ElectronicBilling.getLastVoucher(
        ncData.punto_venta,
        codigoNC
      );

      const nuevoNumero = ultimoNumero + 1;

      // 6. Crear NC en AFIP
      const ncParams = {
        CantReg: 1,
        PtoVta: ncData.punto_venta,
        CbteTipo: codigoNC,
        Concepto: 1, // Productos
        DocTipo: 80,
        DocNro: parseInt(ncData.cuit_cliente),
        CbteDesde: nuevoNumero,
        CbteHasta: nuevoNumero,
        CbteFch: this.formatDate(new Date()),
        ImpTotal: parseFloat(ncData.monto_neto) + parseFloat(ncData.monto_iva),
        ImpTotConc: 0,
        ImpNeto: parseFloat(ncData.monto_neto),
        ImpOpEx: 0,
        ImpIVA: parseFloat(ncData.monto_iva),
        ImpTrib: 0,
        MonId: 'PES',
        MonCotiz: 1,
        CbtesAsoc: [
          {
            Tipo: this.getTipoComprobanteCode(ncData.tipo_factura),
            PtoVta: ncData.punto_venta,
            Nro: parseInt(facturaOriginal.numero_comprobante)
          }
        ]
      };

      if (ncData.tipo_factura === 'A' && ncData.monto_iva > 0) {
        ncParams.Iva = [
          {
            Id: 5,
            BaseImp: parseFloat(ncData.monto_neto),
            Importe: parseFloat(ncData.monto_iva)
          }
        ];
      }

      const afipResponse = await afip.ElectronicBilling.createVoucher(ncParams);

      if (!afipResponse.CAE) {
        throw new AppError('Error al crear NC en AFIP', 500, afipResponse.Observaciones);
      }

      // 7. Marcar factura original como anulada
      await supabase.rpc('anular_factura', {
        p_comprobante_id: factura_original_id,
        p_motivo: motivo
      });

      // 8. Guardar NC
      await supabase.rpc('guardar_factura_afip', {
        p_user_id: userId,
        p_tipo: 'NC_' + ncData.tipo_factura,
        p_codigo_afip: codigoNC,
        p_punto_venta: ncData.punto_venta,
        p_numero: nuevoNumero,
        p_cae: afipResponse.CAE,
        p_fecha_vto_cae: this.parseAfipDate(afipResponse.CAEFchVto),
        p_cuit_cliente: ncData.cuit_cliente,
        p_razon_social: facturaOriginal.contraparte_nombre,
        p_monto_neto: ncData.monto_neto,
        p_monto_iva: ncData.monto_iva,
        p_monto_total: parseFloat(ncData.monto_neto) + parseFloat(ncData.monto_iva),
        p_concepto: ncData.observaciones
      });

      await cleanupTempCerts(cert.cuit);

      const numeroCompleto = `${String(ncData.punto_venta).padStart(5, '0')}-${String(nuevoNumero).padStart(8, '0')}`;

      return {
        success: true,
        nota_credito: {
          tipo: 'NC_' + ncData.tipo_factura,
          numero: numeroCompleto,
          cae: afipResponse.CAE,
          factura_anulada: facturaOriginal.comprobante_completo
        }
      };
    } catch (error) {
      logger.error('Error creating credit note:', error);
      throw error.isOperational ? error : new AppError('Error al crear nota de crédito', 500, error.message);
    }
  }

  /**
   * Obtener último número de comprobante
   */
  async getUltimoComprobante(userId, puntoVenta, tipoComprobante) {
    try {
      const { data: certData } = await supabase
        .rpc('get_user_afip_cert', { p_user_id: userId });

      if (!certData || certData.length === 0) {
        throw new AppError('No se encontraron certificados AFIP', 404);
      }

      const cert = certData[0];
      const afip = await createAfipInstance(cert);

      const codigoMap = { 'A': 1, 'B': 6, 'C': 11 };
      const codigo = codigoMap[tipoComprobante];

      if (!codigo) {
        throw new AppError('Tipo de comprobante inválido', 400);
      }

      const ultimoNumero = await afip.ElectronicBilling.getLastVoucher(
        parseInt(puntoVenta),
        codigo
      );

      await cleanupTempCerts(cert.cuit);

      return {
        punto_venta: puntoVenta,
        tipo_comprobante: tipoComprobante,
        ultimo_numero: ultimoNumero,
        proximo_numero: ultimoNumero + 1
      };
    } catch (error) {
      logger.error('Error getting last voucher:', error);
      throw new AppError('Error al obtener último comprobante', 500, error.message);
    }
  }

  // ========== MÉTODOS AUXILIARES ==========

  validateInvoiceData(data) {
    const required = ['cuit_cliente', 'tipo_factura', 'punto_venta', 'monto_neto'];
    for (const field of required) {
      if (!data[field]) {
        throw new AppError(`Campo requerido: ${field}`, 400);
      }
    }

    if (!['A', 'B', 'C'].includes(data.tipo_factura)) {
      throw new AppError('Tipo de factura inválido. Debe ser A, B o C', 400);
    }

    if (data.monto_neto <= 0) {
      throw new AppError('El monto neto debe ser mayor a 0', 400);
    }
  }

  determinarTipoFactura(tipoSolicitado, condicionIvaCliente) {
    // Si el cliente es Responsable Inscripto → Factura A
    if (condicionIvaCliente.includes('Responsable Inscripto')) {
      return 'A';
    }
    // Si es Monotributista o Consumidor Final → Factura B
    if (condicionIvaCliente.includes('Monotributo') || condicionIvaCliente.includes('Consumidor Final')) {
      return 'B';
    }
    // Exento → Factura C
    if (condicionIvaCliente.includes('Exento')) {
      return 'C';
    }
    // Default: usar el tipo solicitado
    return tipoSolicitado;
  }

  calcularTotales(montoNeto, montoIva, tipoFactura) {
    const neto = parseFloat(montoNeto);
    let iva = 0;

    if (tipoFactura === 'A') {
      // Factura A: IVA discriminado
      iva = montoIva ? parseFloat(montoIva) : neto * 0.21;
    } else {
      // Factura B/C: IVA incluido
      iva = 0;
    }

    const total = neto + iva;

    return {
      neto: parseFloat(neto.toFixed(2)),
      iva: parseFloat(iva.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }

  getTipoComprobanteCode(tipo) {
    const codes = {
      'A': 1,
      'B': 6,
      'C': 11,
      'NC_A': 3,
      'NC_B': 8,
      'NC_C': 13
    };
    return codes[tipo] || 6;
  }

  getNotaCreditoCode(tipoFactura) {
    const codes = { 'A': 3, 'B': 8, 'C': 13 };
    return codes[tipoFactura] || 8;
  }

  getConceptoCode(concepto) {
    const codes = {
      'Productos': 1,
      'Servicios': 2,
      'Productos y Servicios': 3
    };
    return codes[concepto] || 1;
  }

  mapCondicionIVA(idPersona) {
    const mapping = {
      1: 'IVA Responsable Inscripto',
      4: 'IVA Sujeto Exento',
      5: 'Consumidor Final',
      6: 'Responsable Monotributo',
      9: 'IVA No Responsable',
      13: 'Monotributo Social',
      20: 'IVA Responsable Inscripto (bienes de uso)'
    };
    return mapping[idPersona] || 'Desconocido';
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  parseAfipDate(afipDate) {
    // Formato AFIP: YYYYMMDD → YYYY-MM-DD
    const year = afipDate.substring(0, 4);
    const month = afipDate.substring(4, 6);
    const day = afipDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
}

module.exports = new AfipService();