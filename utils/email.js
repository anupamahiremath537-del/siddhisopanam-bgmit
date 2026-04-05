// utils/email.js - Optimized Nodemailer for Gmail (Fastest for 30-min deadline)
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'bgmitcs034@gmail.com',
    pass: process.env.EMAIL_PASS || 'yzclxidjkiwjxlxc'
  }
});

// Verify connection on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('[Email SMTP Error] Credentials might be invalid:', error.message);
  } else {
    console.log('[Email SMTP] Server is ready to take our messages');
  }
});

module.exports = {
  async sendEmail(to, subject, text, html, attachments = []) {
    try {
      const mailOptions = {
        from: `"EventVault" <${process.env.EMAIL_USER || 'bgmitcs034@gmail.com'}>`,
        to: to,
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br>'),
        attachments: attachments.map(a => ({
          filename: a.filename,
          content: a.content
        }))
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email SENT] To: ${to}, ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };

    } catch (err) {
      console.error(`[Email FATAL ERROR] To: ${to}, Details: ${err.message}`);
      return { error: err.message };
    }
  },

  async sendBroadcast(emails, subject, message, html = null, attachments = []) {
    const results = { success: 0, failure: 0 };
    const uniqueEmails = [...new Set(emails.filter(e => !!e))];
    
    console.log(`[Email Broadcast] Starting for ${uniqueEmails.length} recipients...`);
    
    for (const email of uniqueEmails) {
      const res = await this.sendEmail(email, subject, message, html, attachments);
      if (res.success) results.success++;
      else results.failure++;
      
      // Small delay for Gmail limits
      await new Promise(r => setTimeout(r, 300));
    }
    
    return results;
  }
};
