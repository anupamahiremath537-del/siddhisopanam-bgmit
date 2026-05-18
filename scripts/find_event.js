require('dotenv').config();
const db = require('../utils/database');

async function findEvent() {
  const eventId = '3eb8ffc3-7b8f-4e07-a9b3-f63004b8c279';
  console.log(`Searching for eventId: ${eventId}`);
  
  try {
    const event = await db.findOne('events', { eventId });
    if (event) {
      console.log('Event found:', JSON.stringify(event, null, 2));
    } else {
      console.log('Event not found.');
      
      // Try searching by ID if eventId is missing
      const eventById = await db.findOne('events', { id: eventId });
      if (eventById) {
        console.log('Event found by primary ID:', JSON.stringify(eventById, null, 2));
      } else {
        // List a few events to see the schema/data
        const someEvents = await db.find('events', {}, { limit: 5 });
        console.log('First 5 events in DB:', JSON.stringify(someEvents, null, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

findEvent();
