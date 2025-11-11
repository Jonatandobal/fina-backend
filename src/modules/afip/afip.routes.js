// src/modules/afip/afip.routes.js
const express = require('express');
const router = express.Router();
const afipController = require('./afip.controller');
const { authenticate } = require('../../shared/middlewares/auth');
const { validateCuit, validateInvoice, validateCreditNote } = require('./afip.validators');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * @route POST /api/afip/padron/validate
 * @desc Validar CUIT contra Padrón AFIP A5
 * @access Private
 */
router.post('/padron/validate', validateCuit, afipController.validateCuit);

/**
 * @route POST /api/afip/invoice/create
 * @desc Crear factura electrónica A/B/C
 * @access Private
 */
router.post('/invoice/create', validateInvoice, afipController.createInvoice);

/**
 * @route POST /api/afip/credit-note/create
 * @desc Crear nota de crédito
 * @access Private
 */
router.post('/credit-note/create', validateCreditNote, afipController.createCreditNote);

/**
 * @route GET /api/afip/ultimo-comprobante
 * @desc Obtener último número de comprobante
 * @query punto_venta, tipo (A|B|C)
 * @access Private
 */
router.get('/ultimo-comprobante', afipController.getUltimoComprobante);

module.exports = router;