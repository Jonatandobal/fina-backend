// src/modules/afip/afip.service.js
const { createAfipInstance } = require('../../config/afip');
const supabase = require('../../config/supabase');
const { AppError } = require('../../shared/middlewares/errorHandler');
const logger = require('../../shared/utils/logger');

class AfipService {
  /**
   * Obtener certificados AFIP del usuario desde Supabase
   */
  async getUserCertificates(userId) {
    const { data, error } = await supabase
      .from('comprobantes_oficiales')
      .select('cuit, cert_content, key_content, ambiente')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError('Usuario no tiene certificados AFIP configurados', 404);
    }

    return data;
  }

  /**
   * Validar CUIT contra Padrón AFIP A5
   */
  async validateCuit(userId, cuit) {
    try {
      // Obtener certificados del usuario
      const certData = await this.getUserCertificates(userId);

      // Crear instancia AFIP
      const afip = await createAfipInstance(certData);

      // Consultar padrón A5
      const padronData = await afip.RegisterScopeFive.getTaxpayerDetails(cuit);

      logger.info(`CUIT ${cuit} validated successfully`);

      return {
        cuit,
        validated: true,
        data: padronData
      };
    } catch (error) {
      logger.error(`Error validating CUIT ${cuit}:`, error);
      throw new AppError(
        `Error al validar CUIT: ${error.message}`,
        500,
        error.message
      );
    }
  }

  /**
   * Obtener último número de comprobante
   */
  async getUltimoComprobante(userId, puntoVenta, tipo) {
    try {
      // Obtener certificados del usuario
      const certData = await this.getUserCertificates(userId);

      // Crear instancia AFIP
      const afip = await createAfipInstance(certData);

      // Mapear tipo de comprobante
      const tipoComprobante = this.mapTipoComprobante(tipo);

      // Consultar último comprobante
      const ultimoNumero = await afip.ElectronicBilling.getLastVoucher(
        puntoVenta,
        tipoComprobante
      );

      logger.info(`Last voucher for PV ${puntoVenta}, Type ${tipo}: ${ultimoNumero}`);

      return {
        punto_venta: puntoVenta,
        tipo,
        ultimo_numero: ultimoNumero,
        proximo_numero: ultimoNumero + 1
      };
    } catch (error) {
      logger.error(`Error getting last voucher:`, error);
      throw new AppError(
        `Error al obtener último comprobante: ${error.message}`,
        500,
        error.message
      );
    }
  }

  /**
   * Mapear tipo de comprobante letra a código AFIP
   */
  mapTipoComprobante(tipo) {
    const tipos = {
      'A': 1,  // Factura A
      'B': 6,  // Factura B
      'C': 11  // Factura C
    };

    return tipos[tipo.toUpperCase()] || 6; // Default: Factura B
  }
}

module.exports = new AfipService();
