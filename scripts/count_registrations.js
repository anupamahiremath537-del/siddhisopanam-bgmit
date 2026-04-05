require('dotenv').config();
const db = require('../utils/database');

async function count() {
  try {
    const regs = await db.find('registrations', {});
    console.log('Total Registrations in DB:', regs.length);
    if (regs.length > 0) {
      console.log('Sample Email:', regs[0].email);
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed to connect to DB:', err);
    process.exit(1);
  }
}

count();
