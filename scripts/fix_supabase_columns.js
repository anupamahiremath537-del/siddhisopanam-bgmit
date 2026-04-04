const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const sql = `
-- Function to safely rename a column if it exists (handles both old camelCase and potential typos)
CREATE OR REPLACE FUNCTION rename_column_if_exists(t_name text, old_col text, new_col text) 
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = old_col) THEN
    -- If new_col already exists, we might want to drop it or ignore this
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = new_col) THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', t_name, old_col, new_col);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fix 'events' table
SELECT rename_column_if_exists('events', 'eventId', 'eventid');
SELECT rename_column_if_exists('events', 'endTime', 'endtime');
SELECT rename_column_if_exists('events', 'participantLimit', 'participantlimit');
SELECT rename_column_if_exists('events', 'volunteerRoles', 'volunteerroles');
SELECT rename_column_if_exists('events', 'isSupportiveTeam', 'issupportiveteam');
SELECT rename_column_if_exists('events', 'teamMode', 'teammode');
SELECT rename_column_if_exists('events', 'teamSize', 'teamsize');
SELECT rename_column_if_exists('events', 'signupUrl', 'signupurl');
SELECT rename_column_if_exists('events', 'qrCode', 'qrcode');
SELECT rename_column_if_exists('events', 'createdAt', 'createdat');
SELECT rename_column_if_exists('events', 'createdBy', 'createdby');
SELECT rename_column_if_exists('events', 'updatedAt', 'updatedat');
SELECT rename_column_if_exists('events', 'creatadat', 'createdat');

-- Fix 'users' table
SELECT rename_column_if_exists('users', 'createdAt', 'createdat');
SELECT rename_column_if_exists('users', 'displayName', 'displayname');
SELECT rename_column_if_exists('users', 'photoURL', 'photourl');

-- Fix 'registrations' table
SELECT rename_column_if_exists('registrations', 'registrationId', 'registrationid');
SELECT rename_column_if_exists('registrations', 'eventId', 'eventid');
SELECT rename_column_if_exists('registrations', 'registeredAt', 'registeredat');
SELECT rename_column_if_exists('registrations', 'roleId', 'roleid');
SELECT rename_column_if_exists('registrations', 'roleName', 'rolename');
SELECT rename_column_if_exists('registrations', 'teamName', 'teamname');
SELECT rename_column_if_exists('registrations', 'teamMembers', 'teammembers');
SELECT rename_column_if_exists('registrations', 'hoursVolunteered', 'hoursvolunteered');
SELECT rename_column_if_exists('registrations', 'swapRequested', 'swaprequested');
SELECT rename_column_if_exists('registrations', 'swapRequestedRoleId', 'swaprequestedroleid');
SELECT rename_column_if_exists('registrations', 'swapReason', 'swapreason');
SELECT rename_column_if_exists('registrations', 'swapRequestedAt', 'swaprequestedat');
SELECT rename_column_if_exists('registrations', 'swapRequestedNewEmail', 'swaprequestednewemail');
SELECT rename_column_if_exists('registrations', 'swapRequestedNewName', 'swaprequestednewname');
SELECT rename_column_if_exists('registrations', 'swapRequestedNewUsn', 'swaprequestednewusn');
SELECT rename_column_if_exists('registrations', 'swapApprovedAt', 'swapapprovedat');
SELECT rename_column_if_exists('registrations', 'swapRejectedAt', 'swaprejectedat');
SELECT rename_column_if_exists('registrations', 'checkedIn', 'checkedin');
SELECT rename_column_if_exists('registrations', 'checkinAt', 'checkinat');
SELECT rename_column_if_exists('registrations', 'approvedAt', 'approvedat');
SELECT rename_column_if_exists('registrations', 'rejectedAt', 'rejectedat');
SELECT rename_column_if_exists('registrations', 'cancelledAt', 'cancelledat');
SELECT rename_column_if_exists('registrations', 'noShow', 'noshow');

-- Fix 'manual_certificates' table
SELECT rename_column_if_exists('manual_certificates', 'certId', 'certid');
SELECT rename_column_if_exists('manual_certificates', 'academicYear', 'academicyear');
SELECT rename_column_if_exists('manual_certificates', 'createdAt', 'createdat');
SELECT rename_column_if_exists('manual_certificates', 'sentAt', 'sentat');

-- Fix 'otps' table
SELECT rename_column_if_exists('otps', 'expiresAt', 'expiresat');
SELECT rename_column_if_exists('otps', 'createdAt', 'createdat');
SELECT rename_column_if_exists('otps', 'secretCode', 'secretcode');

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';

-- Clean up the helper function
DROP FUNCTION rename_column_if_exists(text, text, text);
  `;

  console.log('🚀 Attempting to normalize column names to lowercase in Supabase...');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      if (error.message.includes('function exec_sql(text) does not exist')) {
        console.error('❌ The "exec_sql" function is not installed in your Supabase database.');
        console.log('Please run the SQL manually in the Supabase SQL Editor.');
      } else {
        console.error('❌ Error executing SQL:', error.message);
      }
    } else {
      console.log('✅ Successfully normalized all column names to lowercase!');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

run();
