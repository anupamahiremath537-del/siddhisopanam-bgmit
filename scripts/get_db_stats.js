require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function stats() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const tables = ['events', 'registrations', 'users'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Error counting ${table}:`, error.message);
    } else {
      console.log(`${table} count:`, count);
    }
  }
}

stats();
