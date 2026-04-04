require('dotenv').config();
const functions = require('firebase-functions/v1');
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./utils/database');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const analyticsRoutes = require('./routes/analytics');
const certificateRoutes = require('./routes/certificates');
const chatRoutes = require('./routes/chat');

const reminderService = require('./utils/reminders');
const emailUtil = require('./utils/email');
const { stringify } = require('csv-stringify');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/chat', chatRoutes);

// Serve static files when running as a standalone app (Local or Cloud Run)
if (!process.env.FUNCTION_NAME || process.env.K_SERVICE) {
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Serve pages
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.get('/choice/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'choice.html')));
  app.get('/signup/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
  app.get('/user-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-login.html')));
  app.get('/user-signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-signup.html')));

  // For Google Cloud Run, it's better to always listen on PORT (which defaults to 8080)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Event App running at http://0.0.0.0:${PORT}\n`);
    seedAdmin();
  });

  // Local/Cloud Run node-cron setup
  cron.schedule('*/15 * * * *', () => {
    console.log('[Cron] Running reminders...');
    reminderService.sendReminders();
  });
  cron.schedule('0 9,12,15,18,21 * * *', () => {
    console.log('[Cron] Running daily report...');
    sendDailyCSVReport();
  });
}

// ─── FIREBASE CLOUD FUNCTIONS ─────────────────────────────────────────────

// Main API Export
exports.api = functions.https.onRequest(app);

// Scheduled Reminders
exports.scheduledReminders = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    console.log('[Scheduled] Running reminders...');
    await reminderService.sendReminders();
    return null;
  });

// Scheduled CSV Report (Runs at 9am, 12pm, 3pm, 6pm, 9pm IST)
exports.scheduledDailyReport = functions.pubsub
  .schedule('0 9,12,15,18,21 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    await sendDailyCSVReport();
    return null;
  });

// ─── UTILS ────────────────────────────────────────────────────────────────

// Seed admin user on startup
async function seedAdmin() {
  const bcrypt = require('bcryptjs');
  try {
    const adminUser = process.env.SEED_ADMIN_USERNAME;
    const adminPass = process.env.SEED_ADMIN_PASSWORD;
    if (!adminUser || !adminPass) {
      console.warn('⚠️ Admin seeding skipped: SEED_ADMIN_USERNAME or SEED_ADMIN_PASSWORD not set.');
      return;
    }
    const doc = await db.findOne('users', { role: 'admin' });
    if (!doc) {
      const hash = await bcrypt.hash(adminPass, 10);
      await db.insert('users', { username: adminUser, password: hash, role: 'admin', name: 'Event Organizer', email: 'admin@events.com', createdAt: new Date() });
      console.log(`✅ Admin seeded: username=${adminUser}, password=${adminPass}`);
    }
  } catch (err) {
    console.error('❌ Error seeding admin:', err.message);
  }
}

// Automated CSV Reports
async function sendDailyCSVReport() {
  console.log('[Scheduled Report] Generating automated CSV export...');
  try {
    const regs = await db.find('registrations', { status: { $ne: 'cancelled' } });
    const rows = [['Event', 'Name', 'Email', 'USN', 'Phone', 'Type', 'Role / Event', 'Team Name', 'Status', 'Registered At', 'Check-in']];

    // Enrich with event titles
    const enriched = await Promise.all(regs.map(async r => {
      const event = await db.findOne('events', { eventId: r.eventId });
      const roleOrEvent = r.type === 'volunteer' ? (r.roleName || '') : (event?.title || '');
      return {
        data: [event?.title || 'Unknown', r.name, r.email, r.usn || '', r.phone || '', r.type, roleOrEvent, r.teamName || '', r.status, new Date(r.registeredAt).toLocaleString(), r.checkedIn ? 'Yes' : 'No'],
        registeredAt: r.registeredAt
      };
    }));

    // Sort by registration date descending
    enriched.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

    enriched.forEach(item => rows.push(item.data));

    stringify(rows, async (err, output) => {
      if (err) return console.error('[Scheduled Report] CSV Error:', err);

      const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      const subject = `EventVault Automated Report - ${timestamp}`;
      const text = `Please find attached the automated registrations report for all events as of ${timestamp}.`;
      const filename = `eventvault-report-${new Date().toISOString().split('T')[0]}.csv`;

      await emailUtil.sendEmail(
        process.env.ADMIN_EMAIL || 'bgmitcs034@gmail.com',
        subject,
        text,
        null,
        [{ filename, content: output }]
      );
      console.log('[Scheduled Report] Report emailed successfully to admin.');
    });
  } catch (err) {
    console.error('[Scheduled Report] Fatal Error:', err);
  }
}

// Cloud Function environment handles execution
module.exports = {
  api: exports.api,
  scheduledReminders: exports.scheduledReminders,
  scheduledDailyReport: exports.scheduledDailyReport
};
