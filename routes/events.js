const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { stringify } = require('csv-stringify');
const db = require('../utils/database');
const authMiddleware = require('../middleware/auth');

// GET /api/events - List events (filtered for organizers)
router.get('/', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'eventvault_secret_2024';
    const auth = req.headers.authorization;
    let user = null;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.split(' ')[1];
        user = jwt.verify(token, JWT_SECRET);
      } catch (e) { /* ignore */ }
    }

    // Fetch all non-deleted events and handle filtering/sorting in JS to avoid index issues
    console.log('[Events API] Fetching events...');
    let rawEvents = await db.find('events', { status: { $ne: 'deleted' } });
    let events = rawEvents.filter(e => e !== null);
    console.log(`[Events API] Found ${events.length} valid events (out of ${rawEvents.length} raw).`);
    
    // Filter by results status if requested
    if (req.query.hasResults === 'true') {
      console.log('[Events API] Filtering by hasResults...');
      events = events.filter(e => e.results && typeof e.results === 'object' && Object.keys(e.results).length > 0);
    }

    // Filter by supportive team status
    if (req.query.isSupportiveTeam === 'true') {
      console.log('[Events API] Filtering by isSupportiveTeam=true...');
      events = events.filter(e => e.isSupportiveTeam === true || e.isSupportiveTeam === 'true');
    } else if (req.query.isSupportiveTeam === 'false') {
      console.log('[Events API] Filtering by isSupportiveTeam=false...');
      events = events.filter(e => e.isSupportiveTeam !== true && e.isSupportiveTeam !== 'true');
    }
    
    if (user && user.role === 'organizer') {
      console.log(`[Events API] Filtering for organizer: ${user.username}`);
      events = events.filter(e => e.createdBy === user.username);
    }

    // Sort by date ascending
    console.log('[Events API] Sorting events...');
    events.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return da - db;
    });

    if (events.length === 0) {
      console.log('[Events API] No events after filtering.');
      return res.json([]);
    }

    // Optimize: Fetch all registrations for these events in ONE go
    const eventIds = events.map(e => e.eventId || e.id).filter(id => id);
    console.log('[Events API] Fetching registrations for eventIds count:', eventIds.length);
    const rawAllRegs = await db.find('registrations', { 
      eventId: { $in: eventIds }, 
      status: { $ne: 'cancelled' } 
    });
    const allRegs = rawAllRegs.filter(r => r !== null);
    console.log(`[Events API] Found ${allRegs.length} valid registrations.`);

    // Group registrations by eventId for fast lookup
    const regsByEvent = {};
    allRegs.forEach(r => {
      const eid = r.eventId;
      if (eid) {
        if (!regsByEvent[eid]) regsByEvent[eid] = [];
        regsByEvent[eid].push(r);
      }
    });

    // Attach slot info
    console.log('[Events API] Enriching events with registration counts...');
    const enriched = events.map(ev => {
      const regs = regsByEvent[ev.eventId] || regsByEvent[ev.id] || [];
      const volunteerRegs = regs.filter(r => r.type === 'volunteer');
      const participantRegs = regs.filter(r => r.type === 'participant');
      const roles = (ev.volunteerRoles || []).map(role => {
        const filled = volunteerRegs.filter(r => r.roleId === role.id).length;
        return { ...role, filled, remaining: Math.max(0, role.slots - filled) };
      });
      return { ...ev, roles, participantCount: participantRegs.length, volunteerCount: volunteerRegs.length };
    });
    res.json(enriched);
  } catch (err) {
    console.error('❌ [EVENTS API ERROR]', err);
    res.status(500).json({ error: err.message });
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
  try {
    // Check approval
    if (req.user.role === 'organizer' && req.user.approved === false) {
      return res.status(403).json({ error: 'Your account is pending approval. You cannot create events yet.' });
    }

    const { title, date, time, endTime, location, description, participantLimit, volunteerRoles, category, teamSize, teamMode, scope, isSupportiveTeam } = req.body;
    if (!title || !date || !time || !location) return res.status(400).json({ error: 'Title, date, time, location are required' });

    const eventId = uuidv4();
    const baseUrl = process.env.BASE_URL || 'https://siddhisopanam-bgmit.onrender.com';
    const signupUrl = `${baseUrl}/signup/${eventId}`;

    const roles = (volunteerRoles || []).map(r => ({ ...r, id: r.id || uuidv4() }));

    const isSupTeam = isSupportiveTeam === true || isSupportiveTeam === 'true';

    const event = await db.insert('events', {
      eventId, title, date, time, endTime: endTime || '', location, description: description || '',
      participantLimit: parseInt(participantLimit) || 100,
      volunteerRoles: roles, category: category || 'General',
      scope: scope || 'inhouse',
      isSupportiveTeam: isSupTeam,
      teamMode: teamMode || 'individual',
      teamSize: teamMode === 'team' ? (parseInt(teamSize) || 0) : 0,
      signupUrl, status: 'active',
      registrationStatus: 'open',
      createdAt: new Date(), createdBy: req.user.username,
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const { title, date, time, endTime, location, description, participantLimit, volunteerRoles, category, teamSize, teamMode, scope, status, isSupportiveTeam } = req.body;
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
    const rows = [['Name', 'Email', 'USN', 'Phone', 'Type', 'Role / Event', 'Team Name', 'Status', 'Registered At', 'Check-in']];
    regs.forEach(r => {
      const roleOrEvent = r.type === 'volunteer' ? (r.roleName || '') : (event?.title || '');
      rows.push([r.name, r.email, r.usn || '', r.phone || '', r.type, roleOrEvent, r.teamName || '', r.status, new Date(r.registeredAt).toLocaleString(), r.checkedIn ? 'Yes' : 'No']);
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
