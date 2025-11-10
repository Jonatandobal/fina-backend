// src/shared/middlewares/auth.js
const { AppError } = require('./errorHandler');
const supabase = require('../../config/supabase');

const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      throw new AppError('Missing X-User-ID header', 401);
    }

    const { data, error } = await supabase
      .from('comprobantes_oficiales')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      throw new AppError('Error validating user', 500, error.message);
    }

    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticate };
