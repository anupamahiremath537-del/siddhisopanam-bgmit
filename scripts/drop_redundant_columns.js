require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function drop() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const columnsToDrop = [
    'eventId', 'endTime', 'participantLimit', 'volunteerRoles', 
    'isSupportiveTeam', 'teamMode', 'teamSize', 'signupUrl', 'updatedAt',
    'registrationId', 'registeredAt', 'roleId', 'roleName', 'teamName',
    'teamMembers', 'hoursVolunteered', 'swapRequested', 'swapRequestedRoleId',
    'swapReason', 'swapRequestedAt', 'swapRequestedNewEmail', 'swapRequestedNewName',
    'swapRequestedNewUsn', 'swapApprovedAt', 'swapRejectedAt', 'checkedIn',
    'checkinAt', 'approvedAt', 'rejectedAt', 'cancelledAt', 'noShow',
    'certId', 'academicYear', 'sentAt', 'expiresAt', 'createdAt', 'createdBy'
  ];

  const tables = ['events', 'registrations', 'users', 'otps', 'manual_certificates', 'registered_users'];

  console.log('Dropping redundant camelCase columns...');
  
  for (const table of tables) {
    for (const column of columnsToDrop) {
      const sql = `ALTER TABLE ${table} DROP COLUMN IF EXISTS "${column}";`;
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        // console.error(`Error dropping ${column} from ${table}:`, error.message);
      } else {
        // console.log(`Dropped ${column} from ${table} (if it existed)`);
      }
    }
  }

  console.log('Finished dropping redundant columns.');
}

drop();
