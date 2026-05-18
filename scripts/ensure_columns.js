require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const sql = `
    -- Function to ensure a column exists
    CREATE OR REPLACE FUNCTION add_column_if_not_exists(t_name text, c_name text, c_type text) 
    RETURNS void AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = c_name) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', t_name, c_name, c_type);
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    -- Ensure essential columns in 'events'
    SELECT add_column_if_not_exists('events', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('events', 'updatedat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('events', 'issupportiveteam', 'boolean');
    SELECT add_column_if_not_exists('events', 'teammode', 'text');
    SELECT add_column_if_not_exists('events', 'teamsize', 'integer');
    SELECT add_column_if_not_exists('events', 'scope', 'text');
    SELECT add_column_if_not_exists('events', 'category', 'text');
    SELECT add_column_if_not_exists('events', 'status', 'text');
    SELECT add_column_if_not_exists('events', 'createdby', 'text');
    SELECT add_column_if_not_exists('events', 'eventid', 'text');
    SELECT add_column_if_not_exists('events', 'endtime', 'text');
    SELECT add_column_if_not_exists('events', 'participantlimit', 'integer');
    SELECT add_column_if_not_exists('events', 'volunteerroles', 'jsonb');
    SELECT add_column_if_not_exists('events', 'signupurl', 'text');
    SELECT add_column_if_not_exists('events', 'qrcode', 'text');

    -- Ensure essential columns in 'users'
    SELECT add_column_if_not_exists('users', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('users', 'updatedat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('users', 'approved', 'boolean');
    SELECT add_column_if_not_exists('users', 'approve', 'boolean');
    SELECT add_column_if_not_exists('users', 'displayname', 'text');
    SELECT add_column_if_not_exists('users', 'photourl', 'text');

    -- Ensure essential columns in 'registrations'
    SELECT add_column_if_not_exists('registrations', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('registrations', 'registeredat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('registrations', 'eventid', 'text');
    SELECT add_column_if_not_exists('registrations', 'registrationid', 'text');
    SELECT add_column_if_not_exists('registrations', 'roleid', 'text');
    SELECT add_column_if_not_exists('registrations', 'rolename', 'text');
    SELECT add_column_if_not_exists('registrations', 'teamname', 'text');
    SELECT add_column_if_not_exists('registrations', 'teammembers', 'jsonb');
    SELECT add_column_if_not_exists('registrations', 'checkedin', 'boolean');
    SELECT add_column_if_not_exists('registrations', 'checkinat', 'timestamp with time zone');

    -- Ensure essential columns in 'otps'
    SELECT add_column_if_not_exists('otps', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('otps', 'expiresat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('otps', 'otp', 'text');
    SELECT add_column_if_not_exists('otps', 'email', 'text');

    -- Ensure essential columns in 'manual_certificates'
    SELECT add_column_if_not_exists('manual_certificates', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('manual_certificates', 'certid', 'text');
    SELECT add_column_if_not_exists('manual_certificates', 'academicyear', 'text');
    SELECT add_column_if_not_exists('manual_certificates', 'sentat', 'timestamp with time zone');

    -- Ensure essential columns in 'registered_users'
    SELECT add_column_if_not_exists('registered_users', 'createdat', 'timestamp with time zone');
    SELECT add_column_if_not_exists('registered_users', 'email', 'text');
    SELECT add_column_if_not_exists('registered_users', 'usn', 'text');
    SELECT add_column_if_not_exists('registered_users', 'name', 'text');
    SELECT add_column_if_not_exists('registered_users', 'phone', 'text');
    SELECT add_column_if_not_exists('registered_users', 'type', 'text');

    -- Refresh schema
    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Ensuring all essential columns exist in all tables...');
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error ensuring columns:', error.message);
  } else {
    console.log('Successfully ensured all essential columns!');
  }
}

run();
