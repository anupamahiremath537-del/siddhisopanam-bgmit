require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function inspect() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Inspecting columns of all tables in public schema...');
  const sql = `
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error inspecting schema:', error.message);
  } else {
    console.log('Schema Information:');
    const tables = {};
    data.forEach(row => {
        if (!tables[row.table_name]) tables[row.table_name] = [];
        tables[row.table_name].push({ column: row.column_name, type: row.data_type });
    });
    console.log(JSON.stringify(tables, null, 2));
  }
}

inspect();
