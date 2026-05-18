require('dotenv').config();
const db = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

async function fix() {
  try {
    const events = await db.find('events', {});
    console.log(`Found ${events.length} events.`);

    const baseUrl = process.env.BASE_URL || 'https://siddhisopanam-bgmit.onrender.com';

    for (const event of events) {
      if (!event.eventId) {
        const newEventId = uuidv4();
        const signupUrl = `${baseUrl}/signup/${newEventId}`;
        console.log(`Fixing event "${event.title}" with new eventId: ${newEventId}`);
        
        await db.update('events', { _id: event._id }, { 
          $set: { 
            eventId: newEventId, 
            signupUrl: signupUrl 
          } 
        });
      }
    }
    console.log('Done fixing events.');
  } catch (err) {
    console.error('Error fixing events:', err.message);
  }
}

fix();
