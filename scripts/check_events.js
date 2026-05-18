require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function check() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  
  console.log('Using SUPABASE_SERVICE_KEY, length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 'N/A');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Testing head query...');
  const { error: headError } = await supabase.from('events').select('count', { count: 'exact', head: true });
  if (headError) console.error('Head query error:', headError.message);
  else console.log('Head query success!');

  const { data, error } = await supabase.from('events').select('title, issupportiveteam').limit(20);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Events found:', data.length);
    data.forEach(e => {
        console.log(`- ${e.title}: issupportiveteam = ${e.issupportiveteam} (${typeof e.issupportiveteam})`);
    });
  }
}
check();
