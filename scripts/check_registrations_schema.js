require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function check() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  console.log('--- Checking Columns for "registrations" ---');
  const sql = `
    SELECT (SELECT json_agg(cols) FROM (
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'registrations'
      ORDER BY column_name
    ) cols) as column_info;
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columns:', data);
  }
}

check();
