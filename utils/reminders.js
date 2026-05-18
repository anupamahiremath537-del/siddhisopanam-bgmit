const db = require('./database');
const emailUtil = require('./email');

<<<<<<< HEAD
let isRunning = false;

async function sendReminders() {
  if (isRunning) {
    console.log('[Reminder Service] Already running, skipping this cycle.');
    return;
  }
  isRunning = true;
=======
async function sendReminders() {
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
  console.log('[Reminder Service] Starting reminder check...');
  try {
    // 1. Calculate the date for tomorrow (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`[Reminder Service] Checking for events on: ${tomorrowStr}`);

    // 2. Find events happening tomorrow
    const upcomingEvents = await db.find('events', { date: tomorrowStr, status: { $ne: 'deleted' } });
    
    if (upcomingEvents.length === 0) {
      console.log('[Reminder Service] No events found for tomorrow.');
<<<<<<< HEAD
      isRunning = false;
=======
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
      return;
    }

    console.log(`[Reminder Service] Found ${upcomingEvents.length} events happening tomorrow.`);

    for (const event of upcomingEvents) {
      console.log(`[Reminder Service] Processing event: ${event.title} (${event.eventId})`);
      
      // 3. Get all active registrations for this event
      const registrations = await db.find('registrations', { 
        eventId: event.eventId, 
        status: { $ne: 'cancelled' } 
      });

      console.log(`[Reminder Service] Found ${registrations.length} registrations for ${event.title}.`);

      // 4. Get all existing reminders for this event to avoid N+1 queries
      const sentReminders = await db.find('reminders', { 
        eventId: event.eventId,
        type: '24h'
      });
<<<<<<< HEAD
      const sentRegIds = new Set(sentReminders.map(r => r.registrationId || r.registrationid));
=======
      const sentRegIds = new Set(sentReminders.map(r => r.registrationId));
>>>>>>> d5586702609478d91f799e3d928811350adb99b4

      for (const reg of registrations) {
        if (!reg.email) continue;

<<<<<<< HEAD
        if (sentRegIds.has(reg.registrationId) || sentRegIds.has(reg.registrationid)) {
=======
        if (sentRegIds.has(reg.registrationId)) {
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
          continue; // Already sent
        }

        // 5. Send email reminder
        const subject = `Reminder: Upcoming Event - ${event.title}`;
        const text = `Hi ${reg.name},\n\nThis is a friendly reminder that the event "${event.title}" is happening tomorrow, ${event.date} at ${event.time}.\n\nLocation: ${event.location}\n\nWe look forward to seeing you there!\n\nBest regards,\nEventVault Team`;
        
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Event Reminder</h2>
            <p>Hi <strong>${reg.name}</strong>,</p>
            <p>This is a friendly reminder that the event <strong>"${event.title}"</strong> is happening tomorrow.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Event:</strong> ${event.title}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${event.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${event.time}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
            </div>
            <p>We look forward to seeing you there!</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #6b7280;">You are receiving this email because you registered for this event on EventVault.</p>
          </div>
        `;

        console.log(`[Reminder Service] Sending reminder to ${reg.email} for ${event.title}...`);
        const emailResult = await emailUtil.sendEmail(reg.email, subject, text, html);

        if (emailResult.success) {
          // 6. Record that the reminder was sent
          await db.insert('reminders', {
<<<<<<< HEAD
            registrationId: reg.registrationId || reg.registrationid,
=======
            registrationId: reg.registrationId,
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
            eventId: event.eventId,
            type: '24h',
            sentAt: new Date().toISOString()
          });
          console.log(`[Reminder Service] Reminder sent successfully to ${reg.email}.`);
        } else {
          console.error(`[Reminder Service] Failed to send reminder to ${reg.email}: ${emailResult.error}`);
        }
<<<<<<< HEAD
        
        // Add a small delay to avoid hitting rate limits
        await new Promise(r => setTimeout(r, 500));
=======
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
      }
    }
    console.log('[Reminder Service] Completed reminder check.');
  } catch (err) {
    console.error('[Reminder Service ERROR]', err);
<<<<<<< HEAD
  } finally {
    isRunning = false;
=======
>>>>>>> d5586702609478d91f799e3d928811350adb99b4
  }
}

module.exports = { sendReminders };
