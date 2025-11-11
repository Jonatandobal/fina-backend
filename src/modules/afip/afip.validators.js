// src/modules/afip/afip.validators.js
const { z } = require('zod');
const { AppError } = require('../../shared/middlewares/errorHandler');

// Schema para validación de CUIT
const cuitSchema = z.object({
  cuit: z.string()
    .length(11, 'El CUIT debe tener 11 dígitos')
    .regex(/^\d+$/, 'El CUIT solo debe contener números')
});

// Schema para validación de factura
const invoiceSchema = z.object({
  cuit_cliente: z.string()
    .length(11, 'El CUIT del cliente debe tener 11 dígitos')
    .regex(/^\d+$/, 'El CUIT solo debe contener números'),
  
  tipo_factura: z.enum(['A', 'B', 'C'], {
    errorMap: () => ({ message: 'Tipo de factura debe ser A, B o C' })
  }),
  
  punto_venta: z.number()
    .int('Punto de venta debe ser un número entero')
    .min(1, 'Punto de venta debe ser mayor a 0')
    .max(9999, 'Punto de venta no puede ser mayor a 9999'),
  
  concepto: z.enum(['Productos', 'Servicios', 'Productos y Servicios'], {
    errorMap: () => ({ message: 'Concepto inválido' })
  }).optional().default('Productos'),
  
  monto_neto: z.number()
    .positive('El monto neto debe ser mayor a 0')
    .max(999999999, 'Monto demasiado alto'),
  
  monto_iva: z.number()
    .nonnegative('El IVA no puede ser negativo')
    .optional(),
  
  items: z.array(z.object({
    descripcion: z.string(),
    cantidad: z.number().positive(),
    precio_unitario: z.number().positive()
  })).optional().default([]),
  
  fecha_vencimiento_pago: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .optional()
    .nullable(),
  
  observaciones: z.string()
    .max(500, 'Observaciones no puede exceder 500 caracteres')
    .optional()
    .nullable()
});

// Schema para nota de crédito
const creditNoteSchema = z.object({
  factura_original_id: z.string()
    .uuid('ID de factura inválido'),
  
  motivo: z.string()
    .min(5, 'El motivo debe tener al menos 5 caracteres')
    .max(200, 'El motivo no puede exceder 200 caracteres')
    .optional()
    .default('Anulación de factura')
});

/**
 * Middleware para validar CUIT
 */
const validateCuit = (req, res, next) => {
  try {
    cuitSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(', ');
      return next(new AppError(`Validación fallida: ${messages}`, 400));
    }
    next(error);
  }
};

/**
 * Middleware para validar datos de factura
 */
const validateInvoice = (req, res, next) => {
  try {
    // Convertir strings a números si es necesario
    if (req.body.punto_venta) {
      req.body.punto_venta = parseInt(req.body.punto_venta);
    }
    if (req.body.monto_neto) {
      req.body.monto_neto = parseFloat(req.body.monto_neto);
    }
    if (req.body.monto_iva) {
      req.body.monto_iva = parseFloat(req.body.monto_iva);
    }

    invoiceSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(`Validación fallida: ${messages}`, 400));
    }
    next(error);
  }
};

/**
 * Middleware para validar nota de crédito
 */
const validateCreditNote = (req, res, next) => {
  try {
    creditNoteSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(', ');
      return next(new AppError(`Validación fallida: ${messages}`, 400));
    }
    next(error);
  }
};

module.exports = {
  validateCuit,
  validateInvoice,
  validateCreditNote
};