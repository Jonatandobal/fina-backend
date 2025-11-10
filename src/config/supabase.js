// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing Supabase environment variables!');
  console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.error('   SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing');
  console.error('   Configure these in Railway dashboard under Variables tab');
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

console.log('✅ Supabase client initialized successfully');

module.exports = supabase;
