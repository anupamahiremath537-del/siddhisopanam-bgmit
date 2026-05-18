require('dotenv').config();
const db = require('../utils/database');

async function listIds() {
  try {
    const events = await db.find('events', {});
    console.log('Total events:', events.length);
    events.forEach(e => {
      console.log(`- "${e.eventId}" (id: ${e.id}) [${e.title}]`);
    });
  } catch (err) {
    console.error(err);
  }
}

listIds();
