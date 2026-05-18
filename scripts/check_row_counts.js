require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function check() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const sql = `
    SELECT 
      (SELECT count(*) FROM events) as event_count,
      (SELECT count(*) FROM registrations) as registration_count;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Counts:', data);
  }
}

check();
