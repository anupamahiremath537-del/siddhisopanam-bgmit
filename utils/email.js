// utils/email.js - Updated to use Brevo API (No domain required)
const BREVO_API_KEY = process.env.BREVO_API_KEY;

module.exports = {
  async sendEmail(to, subject, text, html, attachments = []) {
    if (!BREVO_API_KEY) {
      console.error('[Email ERROR] BREVO_API_KEY is not configured on Render!');
      return { error: 'Email API key missing' };
    }

    try {
      const formattedAttachments = attachments.map(a => ({
        name: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : Buffer.from(a.content).toString('base64')
      }));

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            name: process.env.EMAIL_FROM_NAME || 'EventVault', 
            email: process.env.EMAIL_USER || 'bgmitcs034@gmail.com' 
          },
          to: [{ email: to }],
          subject: subject,
          textContent: text,
          htmlContent: html || text.replace(/\n/g, '<br>'),
          attachment: formattedAttachments.length > 0 ? formattedAttachments : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`[Email SENT via Brevo] To: ${to}, ID: ${data.messageId}`);
        return { success: true, messageId: data.messageId };
      } else {
        console.error('[Email Brevo ERROR]', data);
        return { error: data.message || 'Brevo API Error' };
      }
    } catch (err) {
      console.error(`[Email FATAL ERROR] To: ${to}, Details: ${err.message}`);
      return { error: err.message };
    }
  },

  async sendBroadcast(emails, subject, message, html = null, attachments = []) {
    const results = { success: 0, failure: 0 };
    const uniqueEmails = [...new Set(emails.filter(e => !!e))];
    
    console.log(`[Email Broadcast] Starting via Brevo for ${uniqueEmails.length} recipients...`);
    
    for (const email of uniqueEmails) {
      const res = await this.sendEmail(email, subject, message, html, attachments);
      if (res.success) results.success++;
      else results.failure++;
      // Brevo allows high speed, but small delay is safer
      await new Promise(r => setTimeout(r, 100));
    }
    
    return results;
  }
};
