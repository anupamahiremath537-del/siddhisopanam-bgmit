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
    const event = await db.findOne('events', { eventId: req.params.eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const regs = await db.find('registrations', { eventId: event.eventId, status: { $ne: 'cancelled' } });
    const vRegs = regs.filter(r => r.type === 'volunteer');
    const pRegs = regs.filter(r => r.type === 'participant');
    const roles = (event.volunteerRoles || []).map(r => ({ ...r, filled: vRegs.filter(vr => vr.roleId === r.id).length }));
    res.json({ ...event, roles, participantCount: pRegs.length, volunteerCount: vRegs.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

module.exports = router;
