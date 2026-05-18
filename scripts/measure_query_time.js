require('dotenv').config();
const { db } = require('../utils/database');

async function measure() {
  console.time('find active events');
  await db.find('events', { status: 'active' });
  console.timeEnd('find active events');

  console.time('count registrations');
  await db.count('registrations', { status: { $ne: 'cancelled' } });
  console.timeEnd('count registrations');

  console.time('find all users');
  await db.find('users', {});
  console.timeEnd('find all users');
}

measure();
