require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkIndexes() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Checking indexes on registrations table...');
  const sql = `
    SELECT
        tablename,
        indexname,
        indexdef
    FROM
        pg_indexes
    WHERE
        schemaname = 'public' AND
        tablename = 'registrations';
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error checking indexes:', error);
    } else if (!data) {
      console.error('No data returned from exec_sql. Is the RPC set up correctly?');
    } else {
      console.log('Indexes found on registrations:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

checkIndexes();
