require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('URL:', SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY length:', SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.length : 'N/A');
  console.log('SUPABASE_SERVICE_KEY length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 'N/A');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Testing connection...');
  const { data, error } = await supabase.from('events').select('count', { count: 'exact', head: true });

  if (error) {
    console.error('Connection error (events):', error.message);
  } else {
    console.log('Connection successful! Row count in events:', data);
  }

  console.log('Testing registrations connection...');
  const { data: regData, error: regError } = await supabase.from('registrations').select('count', { count: 'exact', head: true });
  if (regError) {
    console.error('Connection error (registrations):', regError.message);
  } else {
    console.log('Connection successful! Row count in registrations:', regData);
  }

  console.log('Testing exec_sql...');
  const { error: sqlError } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  if (sqlError) {
    console.error('exec_sql error:', sqlError.message);
  } else {
    console.log('exec_sql working!');
  }
}

test();
