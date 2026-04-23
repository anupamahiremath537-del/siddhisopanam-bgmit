const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { stringify } = require('csv-stringify');
const db = require('../utils/database');
const authMiddleware = require('../middleware/auth');

// GET /api/events - List events (filtered for organizers)
router.get('/', async (req, res) => {
  console.log(`\n🔍 [Events API] Request received: ${req.method} ${req.url}`);
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'eventvault_secret_2024';
    const auth = req.headers.authorization;
    let user = null;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.split(' ')[1];
        user = jwt.verify(token, JWT_SECRET);
        console.log(`[Events API] Authenticated user: ${user.username} (${user.role})`);
      } catch (e) { 
        console.log('[Events API] Auth token provided but invalid.');
      }
    }

    console.log('[Events API] Step 1: Fetching events from DB...');
    const query = { status: { $ne: 'deleted' } };
    if (req.query.isSupportiveTeam === 'true') {
      query.isSupportiveTeam = true;
    } else if (req.query.isSupportiveTeam === 'false') {
      // Use $or to include both false and null/undefined values
      query.$or = [{ isSupportiveTeam: false }, { isSupportiveTeam: null }];
    }

    let rawEvents = await db.find('events', query);
    if (!Array.isArray(rawEvents)) {
      console.error('[Events API] DB returned non-array for events:', typeof rawEvents);
      rawEvents = [];
    }
    let events = rawEvents.filter(e => e !== null);
    console.log(`[Events API] Step 1 Complete: Found ${events.length} valid events.`);
    
    if (req.query.hasResults === 'true') {
      console.log('[Events API] Step 2: Filtering by hasResults...');
      events = events.filter(e => e.results && typeof e.results === 'object' && Object.keys(e.results).length > 0);
    }
    
    if (user && user.role === 'organizer') {
      console.log(`[Events API] Step 4: Filtering for organizer: ${user.username}`);
      events = events.filter(e => e.createdBy === user.username);
    }

    console.log('[Events API] Step 5: Sorting events...');
    events.sort((a, b) => {
      try {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return da - db;
      } catch (e) { return 0; }
    });

    if (events.length === 0) {
      console.log('[Events API] Step 6: No events after filtering. Returning [].');
      return res.json([]);
    }

    // PERMANENT FIX: Fetch counts individually per event to avoid massive registration load
    const enriched = await Promise.all(events.map(async ev => {
      const pCount = await db.count('registrations', { eventId: ev.eventId, type: 'participant', status: { $ne: 'cancelled' } });
      const vCount = await db.count('registrations', { eventId: ev.eventId, type: 'volunteer', status: { $ne: 'cancelled' } });
      
      const roles = (Array.isArray(ev.volunteerRoles) ? ev.volunteerRoles : []).map(role => {
        return { ...role, filled: 0, remaining: role.slots }; // Basic role info
      });

      return { 
        ...ev, 
        roles, 
        participantCount: pCount, 
        volunteerCount: vCount 
      };
    }));

    console.log('[Events API] Final Step: Sending JSON response.');
    res.json(enriched);
  } catch (err) {
    console.error('❌ [EVENTS API ERROR STACK]', err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/events/:eventId/results - Declare event results (Admin/Organizer Only)
router.put('/:eventId/results', authMiddleware, async (req, res) => {
  try {
    let event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) event = await db.findOne('events', { _id: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { results } = req.body;
    const targetId = event.eventId || req.params.eventId;
    await db.update('events', { eventId: targetId }, { $set: { results, updatedAt: new Date() } });
    res.json({ success: true, message: 'Results declared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:eventId - Single event
router.get('/:eventId', async (req, res) => {
  try {
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Optional: Check if organizer owns this event
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'eventvault_secret_2024';
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.split(' ')[1];
        const user = jwt.verify(token, JWT_SECRET);
        if (user.role === 'organizer' && event.createdBy !== user.username) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } catch (e) { /* ignore */ }
    }

    const regs = await db.find('registrations', { eventId: event.eventId, status: { $ne: 'cancelled' } });
    const volunteerRegs = regs.filter(r => r.type === 'volunteer');
    const participantRegs = regs.filter(r => r.type === 'participant');
    const roles = (event.volunteerRoles || []).map((role, index) => {
      const roleId = role.id || `role-${index}`;
      const filled = volunteerRegs.filter(r => r.roleId === roleId).length;
      return { ...role, id: roleId, filled, remaining: Math.max(0, role.slots - filled) };
    });
    res.json({ ...event, roles, participantCount: participantRegs.length, volunteerCount: volunteerRegs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events - Admin: create event
router.post('/', authMiddleware, async (req, res) => {
  console.log('\n🚀 [Events API] POST / - Creating new event');
  console.log('[Events API] User:', req.user.username);
  try {
    // Check approval
    if (req.user.role === 'organizer' && req.user.approved === false) {
      console.log('[Events API] Creation blocked: Organizer not approved.');
      return res.status(403).json({ error: 'Your account is pending approval. You cannot create events yet.' });
    }

    const { title, date, time, endTime, location, description, participantLimit, volunteerRoles, category, teamSize, teamMode, scope, isSupportiveTeam, registrationDeadline } = req.body;
    console.log('[Events API] Received body:', { title, date, category, registrationDeadline });
    
    if (!title || !date || !time || !location) {
      console.log('[Events API] Validation failed: missing required fields.');
      return res.status(400).json({ error: 'Title, date, time, location are required' });
    }

    const eventId = uuidv4();
    const baseUrl = process.env.BASE_URL || 'https://siddhisopanam-bgmit.onrender.com';
    const signupUrl = `${baseUrl}/signup/${eventId}`;

    const roles = (Array.isArray(volunteerRoles) ? volunteerRoles : []).map(r => ({ ...r, id: r.id || uuidv4() }));
    const isSupTeam = isSupportiveTeam === true || isSupportiveTeam === 'true';

    const eventData = {
      eventId, title, date, time, endTime: endTime || '', location, description: description || '',
      participantLimit: parseInt(participantLimit) || 100,
      volunteerRoles: roles, category: category || 'General',
      scope: scope || 'inhouse',
      isSupportiveTeam: isSupTeam,
      teamMode: teamMode || 'individual',
      teamSize: teamMode === 'team' ? (parseInt(teamSize) || 0) : 0,
      signupUrl, status: 'active',
      registrationStatus: 'open',
      registrationDeadline: registrationDeadline || null,
      createdAt: new Date(), createdBy: req.user.username,
    };

    console.log('[Events API] Inserting into DB...');
    const event = await db.insert('events', eventData);
    console.log('[Events API] Successfully created event:', event.id);
    res.status(201).json(event);
  } catch (err) {
    console.error('❌ [Events API POST ERROR]');
    if (err.stack) console.error(err.stack);
    else console.error(JSON.stringify(err, null, 2) || err);
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      code: err.code,
      details: err.details
    });
  }
});

// PATCH /api/events/:eventId/toggle-registration - Admin/Organizer: toggle open/closed
router.patch('/:eventId/toggle-registration', authMiddleware, async (req, res) => {
  try {
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newStatus = event.registrationStatus === 'closed' ? 'open' : 'closed';
    await db.update('events', { eventId: req.params.eventId }, { $set: { registrationStatus: newStatus, updatedAt: new Date() } });
    res.json({ success: true, registrationStatus: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/events/:eventId - Admin: update event
router.put('/:eventId', authMiddleware, async (req, res) => {
  try {
    let event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) event = await db.findOne('events', { _id: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer') {
      if (req.user.approved === false) return res.status(403).json({ error: 'Account pending approval' });
      if (event.createdBy !== req.user.username) return res.status(403).json({ error: 'Access denied' });
    }

    const { title, date, time, endTime, location, description, participantLimit, volunteerRoles, category, teamSize, teamMode, scope, status, isSupportiveTeam, registrationDeadline } = req.body;
    const roles = (volunteerRoles || []).map(r => ({ ...r, id: r.id || uuidv4() }));
    const targetId = event.eventId || req.params.eventId;
    
    const isSupTeam = isSupportiveTeam === true || isSupportiveTeam === 'true';

    await db.update('events', { eventId: targetId }, { $set: { 
      title, 
      date, 
      time, 
      endTime: endTime || '', 
      location, 
      description: description || '', 
      participantLimit: parseInt(participantLimit), 
      volunteerRoles: roles, 
      category, 
      scope: scope || 'inhouse', 
      isSupportiveTeam: isSupTeam,
      teamMode: teamMode || 'individual', 
      teamSize: teamMode === 'team' ? (parseInt(teamSize) || 0) : 0, 
      status: status || 'active', 
      registrationDeadline: registrationDeadline || null,
      updatedAt: new Date() 
    } });
    const updated = await db.findOne('events', { eventId: targetId });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/events/:eventId - Admin: soft delete
router.delete('/:eventId', authMiddleware, async (req, res) => {
  try {
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.update('events', { eventId: req.params.eventId }, { $set: { status: 'deleted' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:eventId/registrations - Admin: get all registrations for an event
router.get('/:eventId/registrations', authMiddleware, async (req, res) => {
  try {
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const regs = await db.find('registrations', { eventId: req.params.eventId });
    const enriched = regs.map(r => ({ ...r, eventTitle: event?.title }))
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
    res.json(enriched);
  } catch (err) {
    console.error('❌ [EVENTS API ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:eventId/registrations/csv - Admin: export CSV
router.get('/:eventId/registrations/csv', authMiddleware, async (req, res) => {
  try {
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { teamName, type } = req.query;
    const query = { eventId: req.params.eventId, status: { $ne: 'cancelled' } };
    const regs = await db.find('registrations', query, { registeredAt: 1 });
    const rows = [['Name', 'Email', 'USN', 'Phone', 'Type', 'Role', 'Team Name', 'Status', 'Registered At', 'Check-in']];
    regs.forEach(r => {
      const roleInfo = r.type === 'volunteer' ? (r.roleName || 'Volunteer') : '';
      rows.push([r.name, r.email, r.usn || '', r.phone || '', r.type, roleInfo, r.teamName || '', r.status, new Date(r.registeredAt).toLocaleString(), r.checkedIn ? 'Yes' : 'No']);
    });
    stringify(rows, (err, output) => {
      let filename = `${event?.title || 'event'}-registrations`;
      if (type) filename += `-${type}s`;
      if (teamName) filename += `-${teamName}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(output);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
