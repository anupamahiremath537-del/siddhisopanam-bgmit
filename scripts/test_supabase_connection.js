require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  console.log('URL:', SUPABASE_URL);
  console.log('Key length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 0);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Testing connection...');
  const { data, error } = await supabase.from('events').select('count', { count: 'exact', head: true });

  if (error) {
    console.error('Connection error:', error.message);
  } else {
    console.log('Connection successful! Row count in events:', data);
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
