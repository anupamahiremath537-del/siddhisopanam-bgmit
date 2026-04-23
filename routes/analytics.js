const router = require('express').Router();
const db = require('../utils/database');
const authMiddleware = require('../middleware/auth');

// GET /api/analytics/overview - Dashboard stats
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const eventQuery = { status: 'active' };
    if (req.user.role === 'organizer') {
      eventQuery.createdBy = req.user.username;
    }
    
    const activeEvents = await db.find('events', eventQuery);
    const eventIds = activeEvents.map(e => e.eventId);

    const baseRegQuery = { status: { $ne: 'cancelled' } };
    if (req.user.role === 'organizer') {
      baseRegQuery.eventId = { $in: eventIds };
    }
    
    // Optimization: Use db.count for most metrics to avoid fetching massive rows
    const [
      totalRegs,
      totalVolunteers,
      totalParticipants,
      checkedIn,
      noShows,
      swapRequests
    ] = await Promise.all([
      db.count('registrations', baseRegQuery),
      db.count('registrations', { ...baseRegQuery, type: 'volunteer' }),
      db.count('registrations', { ...baseRegQuery, type: 'participant' }),
      db.count('registrations', { ...baseRegQuery, checkedIn: true }),
      db.count('registrations', { ...baseRegQuery, noShow: true }),
      db.count('registrations', { ...baseRegQuery, swapRequested: true })
    ]);

    const totalEvents = activeEvents.length;
    const now = new Date();
    const upcomingEvents = activeEvents.filter(e => new Date(e.date + 'T' + (e.time || '00:00')) > now).length;
    const pastEvents = activeEvents.filter(e => new Date(e.date + 'T' + (e.time || '00:00')) <= now).length;

    // Volunteer coverage per event - Select minimal fields to avoid timeout
    let totalSlots = 0, filledSlots = 0;
    const regFields = 'eventid,roleid,type';
    const regsForCoverage = await db.find('registrations', baseRegQuery, { select: regFields });

    activeEvents.forEach(ev => {
      (ev.volunteerRoles || []).forEach(role => {
        totalSlots += role.slots;
        const filled = regsForCoverage.filter(r => r.eventId === ev.eventId && r.roleId === role.id && r.type === 'volunteer').length;
        filledSlots += Math.min(filled, role.slots);
      });
    });
    
    const volunteerCoverage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    res.json({ totalEvents, upcomingEvents, pastEvents, totalRegs, totalVolunteers, totalParticipants, checkedIn, noShows, swapRequests, volunteerCoverage, filledSlots, totalSlots });
  } catch (err) {
    console.error('❌ [Analytics Overview Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/events - Per-event analytics
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const eventQuery = { status: { $ne: 'deleted' } };
    if (req.user.role === 'organizer') {
      eventQuery.createdBy = req.user.username;
    }
    
    let events = await db.find('events', eventQuery);
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    const eventIds = events.map(e => e.eventId);

    const regQuery = {};
    if (req.user.role === 'organizer') {
      regQuery.eventId = { $in: eventIds };
    }
    
    // Minimal fields to avoid timeout
    const regFields = 'eventid,roleid,type,status,checkedin,noshow';
    let regs = await db.find('registrations', regQuery, { select: regFields });

    const data = events.map(ev => {
      const evRegs = regs.filter(r => r.eventId === ev.eventId);
      const volunteers = evRegs.filter(r => r.type === 'volunteer' && r.status !== 'cancelled');
      const participants = evRegs.filter(r => r.type === 'participant' && r.status !== 'cancelled');
      const checkedIn = evRegs.filter(r => r.checkedIn).length;
      const noShows = evRegs.filter(r => r.noShow).length;
      const cancelled = evRegs.filter(r => r.status === 'cancelled').length;
      let slots = 0, filled = 0;
      (ev.volunteerRoles || []).forEach(role => {
        slots += role.slots;
        filled += Math.min(volunteers.filter(r => r.roleId === role.id).length, role.slots);
      });
      return {
        eventId: ev.eventId, title: ev.title, date: ev.date, category: ev.category,
        volunteers: volunteers.length, participants: participants.length,
        checkedIn, noShows, cancelled,
        coverage: slots > 0 ? Math.round((filled / slots) * 100) : 0,
        totalSlots: slots, filledSlots: filled
      };
    });
    res.json(data);
  } catch (err) {
    console.error('❌ [Analytics Events Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/top-volunteers - Top volunteers by event count
router.get('/top-volunteers', authMiddleware, async (req, res) => {
  try {
    // Minimal fields
    const regs = await db.find('registrations', { type: 'volunteer', status: { $ne: 'cancelled' } }, { select: 'email,name' });
    const map = {};
    regs.forEach(r => {
      if (!map[r.email]) map[r.email] = { name: r.name, email: r.email, events: 0 };
      map[r.email].events++;
    });
    const sorted = Object.values(map).sort((a, b) => b.events - a.events).slice(0, 10);
    res.json(sorted);
  } catch (err) {
    console.error('❌ [Analytics Top Volunteers Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
