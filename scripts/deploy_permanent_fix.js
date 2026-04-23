require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const sql = `
    -- 1. Create a view that handles all the heavy counting logic
    CREATE OR REPLACE VIEW event_summary AS
    SELECT 
      e.*,
      COALESCE(r.participant_count, 0) as "participantCount",
      COALESCE(r.volunteer_count, 0) as "volunteerCount"
    FROM events e
    LEFT JOIN (
      SELECT 
        eventid,
        COUNT(*) FILTER (WHERE type = 'participant') as participant_count,
        COUNT(*) FILTER (WHERE type = 'volunteer') as volunteer_count
      FROM registrations
      WHERE status != 'cancelled'
      GROUP BY eventid
    ) r ON e.eventid = r.eventid;

    -- 2. Ensure critical indexes are perfect
    CREATE INDEX IF NOT EXISTS idx_regs_perf_count ON registrations(eventid, type, status);
    
    -- 3. Refresh
    NOTIFY pgrst, 'reload schema';
  `;

  console.log('🚀 Deploying Permanent SQL Optimizations...');
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('❌ Failed to deploy view:', error.message);
  } else {
    console.log('✅ Permanent SQL View deployed successfully!');
  }
}

run();
