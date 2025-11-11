// src/modules/afip/afip.controller.js
const afipService = require('./afip.service');
const logger = require('../../shared/utils/logger');

class AfipController {
  /**
   * POST /api/afip/padron/validate
   * Validar CUIT contra Padrón AFIP
   */
  async validateCuit(req, res, next) {
    try {
      const { cuit } = req.body;
      const userId = req.userId;

      logger.info(`Validating CUIT: ${cuit} for user: ${userId}`);

      const result = await afipService.validateCuit(userId, cuit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/afip/invoice/create
   * Crear factura electrónica
   */
  async createInvoice(req, res, next) {
    try {
      const userId = req.userId;
      const invoiceData = req.body;

      logger.info(`Creating invoice for user: ${userId}`, { invoiceData });

      const result = await afipService.createInvoice(userId, invoiceData);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/afip/credit-note/create
   * Crear nota de crédito
   */
  async createCreditNote(req, res, next) {
    try {
      const userId = req.userId;
      const { factura_original_id, motivo } = req.body;

      logger.info(`Creating credit note for user: ${userId}`, { factura_original_id });

      const result = await afipService.createCreditNote(userId, {
        factura_original_id,
        motivo
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/afip/ultimo-comprobante
   * Obtener último número de comprobante
   */
  async getUltimoComprobante(req, res, next) {
    try {
      const { punto_venta, tipo } = req.query;
      const userId = req.userId;

      if (!punto_venta || !tipo) {
        return res.status(400).json({
          error: true,
          message: 'Faltan parámetros: punto_venta y tipo son requeridos'
        });
      }

      logger.info(`Getting last voucher for PV: ${punto_venta}, Type: ${tipo}`);

      const result = await afipService.getUltimoComprobante(
        userId,
        punto_venta,
        tipo
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AfipController();