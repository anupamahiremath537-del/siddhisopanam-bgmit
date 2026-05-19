// utils/email.js - Brevo API (HTTP-based) to bypass Render's SMTP block
const fetch = global.fetch || require('node-fetch');

module.exports = {
  /**
   * Send a single transactional email via Brevo API
   */
  async sendEmail(to, subject, text, html = null, attachments = []) {
    const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
    
    if (!BREVO_API_KEY) {
      console.error('[Email ERROR] BREVO_API_KEY is not configured in Environment Variables!');
      return { error: 'Brevo API key missing. Please configure BREVO_API_KEY.' };
    }

    // Safe Debugging: Check if the key looks correct (Length and prefix)
    const keyHint = `${BREVO_API_KEY.substring(0, 4)}...${BREVO_API_KEY.substring(BREVO_API_KEY.length - 4)}`;
    console.log(`[Email Debug] Key Check: Length=${BREVO_API_KEY.length}, Hint=${keyHint}`);

    try {
      const formattedAttachments = attachments.map(a => ({
        name: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : Buffer.from(a.content).toString('base64')
      }));

      // Priority: EMAIL_FROM > EMAIL_USER > Default
      const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'bgmitcs034@gmail.com';
      const senderName = process.env.EMAIL_FROM_NAME || 'BGMIT EventVault';

      console.log(`[Email Debug] Sending to: ${to} | Subject: ${subject} | via Brevo API`);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            name: senderName, 
            email: senderEmail
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
        console.log(`[Email SUCCESS] To: ${to}, MessageID: ${data.messageId || 'Success'}`);
        return { success: true, messageId: data.messageId };
      } else {
        console.error('[Email ERROR - Brevo Rejected]', { status: response.status, data });
        return { error: data.message || data.code || 'Brevo API Error' };
      }
    } catch (err) {
      console.error(`[Email FATAL ERROR] To: ${to}, Details: ${err.message}`);
      return { error: err.message };
    }
  },

  /**
   * Send multiple emails in a loop (individualized)
   */
  async sendBroadcast(emails, subject, message, html = null, attachments = []) {
    const results = { success: 0, failure: 0 };
    const uniqueEmails = [...new Set(emails.filter(e => !!e))];
    
    console.log(`[Email Broadcast] Starting via Brevo API for ${uniqueEmails.length} recipients...`);
    
    for (const email of uniqueEmails) {
      const res = await this.sendEmail(email, subject, message, html, attachments);
      if (res.success) results.success++;
      else results.failure++;
      
      // Small delay between requests to avoid burst rate limits
      await new Promise(r => setTimeout(r, 150));
    }
    
    return results;
  }
};
