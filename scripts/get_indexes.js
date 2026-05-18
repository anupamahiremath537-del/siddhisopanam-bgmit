require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function getIndexes() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sql = `
    SELECT 
      tablename, 
      indexname, 
      indexdef 
    FROM 
      pg_indexes 
    WHERE 
      schemaname = 'public' 
      AND (tablename = 'registrations' OR tablename = 'events');
  `;
  
  // Try direct query if exec_sql is just a wrapper for EXECUTE
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Indexes:', JSON.stringify(data, null, 2));
  }
}

getIndexes();
