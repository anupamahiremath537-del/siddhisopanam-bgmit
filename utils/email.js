const nodemailer = require('nodemailer');

// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS for Port 587
  family: 4,    // FORCE IPv4 to avoid Render's IPv6 issues
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: false // Disable pooling for more reliable single-connection attempts
});

module.exports = {
  async sendEmail(to, subject, text, html, attachments = []) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('[Email ERROR] SMTP credentials not configured');
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
      console.error(`[Email ERROR] To: ${to}, Details: ${err.message}`);
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
    
    // Reduced chunk size for stability on Render free tier
    const CHUNK_SIZE = 2; 
    for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
      const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(email => this.sendEmail(email, subject, message, html, attachments));
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(res => {
        if (res.success) results.success++;
        else results.failure++;
      });
      
      // Small delay between chunks to prevent connection hanging
      await new Promise(r => setTimeout(r, 1000));
      console.log(`[Email Broadcast] Processed ${Math.min(i + CHUNK_SIZE, uniqueEmails.length)} / ${uniqueEmails.length}`);
    }
    
    return results;
  }
};
