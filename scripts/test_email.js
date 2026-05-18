require('dotenv').config();
const emailUtil = require('../utils/email');

async function test() {
  console.log('--- Email Diagnostic ---');
  console.log('USER (Sender):', process.env.EMAIL_USER || 'bgmitcs034@gmail.com (default)');
  console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? '******** (set)' : '(NOT SET)');
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ ERROR: BREVO_API_KEY is missing from .env');
    return;
  }
  
  const testEmail = 'kedardhayapule32@gmail.com';
  console.log(`Sending test email to: ${testEmail}...`);
  
  const result = await emailUtil.sendEmail(
    testEmail,
    'EventVault Diagnostic Test',
    'If you are reading this, your EventVault email configuration is working correctly!\n\nTime: ' + new Date().toLocaleString()
  );
  
  if (result.success) {
    console.log('✅ SUCCESS: Email sent. Message ID:', result.messageId);
    console.log('Please check your Inbox and Spam folder.');
  } else {
    console.error('❌ FAILED:', result.error);
  }
}

test();
