require('dotenv').config();
const db = require('../utils/database');
const emailUtil = require('../utils/email');

async function testRegistration() {
  console.log('--- 📝 Test Registration Flow ---');
  
  const testData = {
    eventId: 'test-event-123',
    name: 'Test Student',
    email: 'bgmitcs034@gmail.com', // Using your sender for the test
    phone: '1234567890',
    usn: '1BG22CS001',
    type: 'participant',
    registeredAt: new Date().toISOString(),
    status: 'confirmed'
  };

  try {
    console.log('1. Creating a dummy event...');
    await db.insert('events', {
      eventId: 'test-event-123',
      title: 'Diagnostic Test Event',
      description: 'Test event for system verification.',
      date: '2026-04-10',
      time: '10:00 AM',
      venue: 'Main Seminar Hall'
    });
    console.log('✅ Event created.');

    console.log('2. Inserting test registration into Supabase...');
    const reg = await db.insert('registrations', testData);
    console.log('✅ Registration saved in DB.');

    console.log('3. Sending confirmation email...');
    const emailResult = await emailUtil.sendEmail(
      testData.email,
      'Registration Confirmed: Diagnostic Test Event',
      `Hello ${testData.name},\n\nYour registration for Diagnostic Test Event has been received successfully.\n\nTime: ${new Date().toLocaleString()}`,
      `<h2>Registration Confirmed!</h2><p>Hello <b>${testData.name}</b>,</p><p>Your registration for <b>Diagnostic Test Event</b> has been received successfully.</p>`
    );

    if (emailResult.success) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Email failed:', emailResult.error);
    }

    console.log('\n--- 🎉 TEST COMPLETE ---');
    console.log('Check your email and your Supabase "registrations" table.');

  } catch (err) {
    console.error('❌ FATAL ERROR:', err.message);
  }
}

testRegistration();
