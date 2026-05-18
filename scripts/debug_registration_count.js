require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debug() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('Counting registrations...');
  const result = await supabase.from('registrations').select('id', { count: 'exact', head: true });
  console.log('Result:', JSON.stringify(result, null, 2));
}

debug();
