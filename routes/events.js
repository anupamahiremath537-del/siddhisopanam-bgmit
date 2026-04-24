const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { stringify } = require('csv-stringify');
const db = require('../utils/database');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    // 1. Fetch ALL events (simple query, never fails)
    let events = await db.find('events', { status: 'active' });
    
    // 2. Filter in memory (Fast and 100% reliable)
    if (req.query.isSupportiveTeam === 'true') {
      events = events.filter(e => e.isSupportiveTeam === true || e.isSupportiveTeam === 'true');
    } else if (req.query.isSupportiveTeam === 'false') {
      events = events.filter(e => e.isSupportiveTeam !== true && e.isSupportiveTeam !== 'true');
    }

    // 3. Count registrations individually
    const enriched = await Promise.all(events.map(async ev => {
      const pCount = await db.count('registrations', { eventId: ev.eventId, type: 'participant', status: { $ne: 'cancelled' } });
      const vCount = await db.count('registrations', { eventId: ev.eventId, type: 'volunteer', status: { $ne: 'cancelled' } });
      return { ...ev, participantCount: pCount, volunteerCount: vCount, roles: (ev.volunteerRoles || []).map(r => ({ ...r, filled: 0, remaining: r.slots })) };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId', async (req, res) => {
  try {
    const rawEventId = req.params.eventId;
    const eventId = rawEventId.trim();
    console.log(`[Events API] Fetching event: "${eventId}" (raw: "${rawEventId}")`);
    
    // 1. Try fetching by eventId (business ID)
    let event = await db.findOne('events', { eventId: eventId });
    
    // 2. Fallback: Try fetching by primary 'id' (database ID)
    if (!event) {
      console.log(`[Events API] Not found by eventId, trying fallback to primary id: ${eventId}`);
      event = await db.findOne('events', { id: eventId });
    }

    if (!event) {
      console.warn(`[Events API] Event not found: ${eventId}`);
      return res.status(404).json({ error: 'Event not found' });
    }
    const regs = await db.find('registrations', { eventId: event.eventId, status: { $ne: 'cancelled' } });
    const vRegs = regs.filter(r => r.type === 'volunteer');
    const pRegs = regs.filter(r => r.type === 'participant');
    
    // Support both camelCase and lowercase for volunteerRoles
    const volunteerRoles = event.volunteerRoles || event.volunteerroles || [];
    const roles = volunteerRoles.map(r => ({ ...r, filled: vRegs.filter(vr => vr.roleId === r.id).length }));
    
    res.json({ ...event, roles, volunteerRoles, participantCount: pRegs.length, volunteerCount: vRegs.length });
  } catch (err) { 
    console.error(`[Events API] Error fetching event ${req.params.eventId}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, date, time, location } = req.body;
    if (!title || !date || !time || !location) return res.status(400).json({ error: 'Missing fields' });
    const eventId = uuidv4();
    const event = await db.insert('events', { ...req.body, eventId, status: 'active', createdAt: new Date(), createdBy: req.user.username });
    res.status(201).json(event);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update event
router.put('/:eventId', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    // Use findOne to get the internal ID if needed
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await db.update('events', { id: event._id }, { ...req.body, updatedAt: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:eventId', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await db.update('events', { id: event._id }, { ...req.body, updatedAt: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update event results
router.put('/:eventId/results', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await db.update('events', { id: event._id }, { results: req.body.results, updatedAt: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete event
router.delete('/:eventId', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await db.remove('events', { id: event._id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
