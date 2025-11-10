// src/modules/afip/afip.routes.js
const express = require('express');
const router = express.Router();
const afipController = require('./afip.controller');
const { authenticate } = require('../../shared/middlewares/auth');
const { validateCuit } = require('./afip.validators');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * @route POST /api/afip/padron/validate
 * @desc Validar CUIT contra Padrón AFIP A5
 * @access Private
 */
router.post('/padron/validate', validateCuit, afipController.validateCuit);

/**
 * @route GET /api/afip/ultimo-comprobante
 * @desc Obtener último número de comprobante
 * @query punto_venta, tipo (A|B|C)
 * @access Private
 */
router.get('/ultimo-comprobante', afipController.getUltimoComprobante);

module.exports = router;