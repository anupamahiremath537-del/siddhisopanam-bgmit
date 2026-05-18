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

    // 3. Count registrations in batch to avoid N+1 queries
    const allRegs = await db.find('registrations', { status: { $ne: 'cancelled' } }, { select: 'eventid,type,roleid' });
    
    // Group registrations by event and role for O(1) lookup
    const pCountMap = new Map();
    const vCountMap = new Map();
    const roleMap = new Map();

    allRegs.forEach(r => {
      if (r.type === 'participant') {
        pCountMap.set(r.eventId, (pCountMap.get(r.eventId) || 0) + 1);
      } else if (r.type === 'volunteer') {
        vCountMap.set(r.eventId, (vCountMap.get(r.eventId) || 0) + 1);
        const roleKey = `${r.eventId}_${r.roleId}`;
        roleMap.set(roleKey, (roleMap.get(roleKey) || 0) + 1);
      }
    });

    const enriched = events.map(ev => {
      const pCount = pCountMap.get(ev.eventId) || 0;
      const vCount = vCountMap.get(ev.eventId) || 0;
      
      const roles = (ev.volunteerRoles || []).map(r => {
        const filled = roleMap.get(`${ev.eventId}_${r.id}`) || 0;
        return { ...r, filled, remaining: Math.max(0, r.slots - filled) };
      });

      return { 
        ...ev, 
        participantCount: pCount, 
        volunteerCount: vCount, 
        roles 
      };
    });

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

// Get event registrations
router.get('/:eventId/registrations', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && event.createdBy !== req.user.username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const regs = await db.find('registrations', { eventId: event.eventId, status: { $ne: 'cancelled' } });
    res.json(regs);
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

// Toggle registration status
router.patch('/:eventId/toggle-registration', authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.eventId.trim();
    let event = await db.findOne('events', { eventId });
    if (!event) event = await db.findOne('events', { id: eventId });
    
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const newStatus = event.registrationStatus === 'closed' ? 'open' : 'closed';
    await db.update('events', { eventId: event.eventId }, { $set: { registrationStatus: newStatus } });
    
    res.json({ ...event, registrationStatus: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
