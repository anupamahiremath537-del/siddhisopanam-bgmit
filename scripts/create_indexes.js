require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const sql = `
    -- Create indexes for 'registrations' table to improve performance and prevent timeouts
    CREATE INDEX IF NOT EXISTS idx_registrations_eventid ON registrations(eventid);
    CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
    CREATE INDEX IF NOT EXISTS idx_registrations_usn ON registrations(usn);
    CREATE INDEX IF NOT EXISTS idx_registrations_type ON registrations(type);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_registrationid ON registrations(registrationid);
    CREATE INDEX IF NOT EXISTS idx_registrations_roleid ON registrations(roleid);
    CREATE INDEX IF NOT EXISTS idx_registrations_teamname ON registrations(teamname);

    -- Also add indexes for 'events' table which is often joined or filtered
    CREATE INDEX IF NOT EXISTS idx_events_eventid ON events(eventid);
    CREATE INDEX IF NOT EXISTS idx_events_createdby ON events(createdby);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

    -- Refresh schema
    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Creating indexes to optimize database performance...');
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error creating indexes:', error.message);
  } else {
    console.log('Successfully created indexes!');
  }
}

run();
