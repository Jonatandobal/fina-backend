// src/modules/afip/afip.validators.js
const { z } = require('zod');
const { AppError } = require('../../shared/middlewares/errorHandler');

// Schema para validación de CUIT
const cuitSchema = z.object({
  cuit: z.string()
    .length(11, 'El CUIT debe tener 11 dígitos')
    .regex(/^\d+$/, 'El CUIT solo debe contener números')
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

module.exports = {
  validateCuit
};