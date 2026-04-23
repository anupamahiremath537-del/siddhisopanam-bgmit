require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./utils/database');
const authRoutes = require('./routes/auth');
const supabaseAuthRoutes = require('./routes/supabase-auth');
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
app.use('/api/supabase-auth', supabaseAuthRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/chat', chatRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('❌ [API ERROR]', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
  
  // Serve pages
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.get('/choice/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'choice.html')));
  app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
  app.get('/signup/:eventId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
  app.get('/user-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-login.html')));
  app.get('/user-signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user-signup.html')));
  app.get('/events', (req, res) => res.sendFile(path.join(__dirname, 'public', 'events.html')));
  app.get('/past-events', (req, res) => res.sendFile(path.join(__dirname, 'public', 'past-events.html')));
  app.get('/supportive-teams', (req, res) => res.sendFile(path.join(__dirname, 'public', 'supportive-teams.html')));
  app.get('/achievements', (req, res) => res.sendFile(path.join(__dirname, 'public', 'achievements.html')));

  // For Google Cloud Run, it's better to always listen on PORT (which defaults to 8080)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Event App (STABLE_V3) running at http://localhost:${PORT}\n`);
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

// ─── UTILS ────────────────────────────────────────────────────────────────

// Seed admin user on startup
async function seedAdmin() {
  const bcrypt = require('bcryptjs');
  let retries = 0;
  const maxRetries = 5;

  while (retries <= maxRetries) {
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
      return; // Success
    } catch (err) {
      retries++;
      console.error(`❌ Attempt ${retries}/${maxRetries + 1} Error seeding admin:`, err.message);
      if (retries <= maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        console.warn(`[Startup Warning] Database not ready. Retrying seed in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('❌ Failed to seed admin after multiple attempts. Application may be unstable.');
      }
    }
  }
}

// Automated CSV Reports
async function sendDailyCSVReport() {
  console.log('[Scheduled Report] Generating automated CSV export...');
  try {
    const selectFields = 'id,eventid,registrationid,name,email,phone,usn,password,type,roleid,rolename,teamname,teammembers,status,checkedin,checkinat,registeredat,swaprequested,noshow,hoursvolunteered';
    const regs = await db.find('registrations', { status: { $ne: 'cancelled' } }, { 
      sort: { registeredAt: -1 },
      select: selectFields
    });
    
    // Fetch all events once to avoid N+1 queries
    const events = await db.find('events', {});
    const eventMap = {};
    events.forEach(e => eventMap[e.eventId] = e);

    const rows = [['Event', 'Name', 'Email', 'USN', 'Phone', 'Type', 'Role', 'Team Name', 'Status', 'Registered At', 'Check-in']];

    regs.forEach(r => {
      const event = eventMap[r.eventId];
      const roleInfo = r.type === 'volunteer' ? (r.roleName || 'Volunteer') : '';
      rows.push([
        event?.title || 'Unknown', 
        r.name, 
        r.email, 
        r.usn || '', 
        r.phone || '', 
        r.type, 
        roleInfo, 
        r.teamName || '', 
        r.status, 
        new Date(r.registeredAt).toLocaleString(), 
        r.checkedIn ? 'Yes' : 'No'
      ]);
    });

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

// End of application
