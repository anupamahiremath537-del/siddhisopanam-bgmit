const nodemailer = require('nodemailer');

// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL (Port 465)
  family: 4,    // FORCE IPv4 ONLY to solve ENETUNREACH errors on Render
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  logger: true, // Enable logging to see the SMTP conversation
  debug: true   // Enable debug output
});

module.exports = {
  async sendEmail(to, subject, text, html, attachments = []) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('[Email ERROR] SMTP credentials not configured in .env');
      return { error: 'SMTP not configured' };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'EventVault'}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
        attachments
      });
      console.log(`[Email SENT] To: ${to}, MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Email ERROR] Details: ${err.stack || err.message}`);
      return { error: err.message };
    }
  },

  /**
   * Sends emails to multiple recipients in parallel with concurrency control
   */
  async sendBroadcast(emails, subject, message, html = null, attachments = []) {
    const results = { success: 0, failure: 0 };
    const uniqueEmails = [...new Set(emails.filter(e => !!e))];
    
    console.log(`[Email Broadcast] Starting for ${uniqueEmails.length} recipients...`);
    
    // Chunk size for concurrency control
    const CHUNK_SIZE = 10;
    for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
      const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(email => this.sendEmail(email, subject, message, html, attachments));
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(res => {
        if (res.success) results.success++;
        else results.failure++;
      });
      
      console.log(`[Email Broadcast] Processed ${Math.min(i + CHUNK_SIZE, uniqueEmails.length)} / ${uniqueEmails.length}`);
    }
    
    return results;
  }
};
