const router = require('express').Router();
const db = require('../utils/database');
const Groq = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');

// --- AI SETUP ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let aiClient = null;
let aiProvider = null;

if (GROQ_API_KEY) {
  console.log('✅ Groq API Key detected. Initializing Groq AI...');
  aiClient = new Groq({ apiKey: GROQ_API_KEY });
  aiProvider = 'groq';
} else if (ANTHROPIC_API_KEY) {
  console.log('✅ Anthropic API Key detected. Initializing Claude...');
  aiClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  aiProvider = 'anthropic';
} else {
  console.error('❌ AI API Keys (GROQ or ANTHROPIC) are missing!');
}

router.post('/', async (req, res) => {
  const { message, email, usn } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const input = message.toLowerCase().trim();
  let reply = "";

  try {
    // --- 1. CONTEXT LOADING ---
    const [allEvents, currentUser, registrations] = await Promise.all([
      db.find('events', { status: { $ne: 'deleted' } }),
      email ? db.findOne('registered_users', { email: email.toLowerCase() }) : Promise.resolve(null),
      email ? db.find('registrations', { email: email.toLowerCase(), status: { $ne: 'cancelled' } }) : Promise.resolve([])
    ]);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const upcomingEvents = allEvents
      .filter(e => (e.isSupportiveTeam !== true && e.isSupportiveTeam !== 'true') && new Date(e.date).setHours(23,59,59,999) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const pastEvents = allEvents
      .filter(e => (e.isSupportiveTeam !== true && e.isSupportiveTeam !== 'true') && new Date(e.date).setHours(23,59,59,999) < now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const supportiveTeams = allEvents.filter(e => e.isSupportiveTeam === true || e.isSupportiveTeam === 'true');

    let mentionedItem = null;
    const allItems = [...allEvents];
    const sortedForMatching = allItems.sort((a, b) => b.title.length - a.title.length);
    for (const item of sortedForMatching) {
      const escapedTitle = (item.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTitle}\\b`, 'i');
      if (regex.test(input)) {
        mentionedItem = item;
        break;
      }
    }

    if (!mentionedItem) {
      mentionedItem = allItems.find(item => {
        const words = (item.title || '').toLowerCase().split(/\s+/);
        return words.some(word => {
          if (word.length <= 3) return false;
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`\\b${escapedWord}\\b`, 'i').test(input);
        });
      });
    }

    let organizerInfo = { name: "Organizer", email: "bgmitcs034@gmail.com", phone: "+91 6363338238" };
    if (mentionedItem) {
      const organizer = await db.findOne('users', { username: mentionedItem.createdBy });
      if (organizer) {
        organizerInfo = { name: organizer.name, email: organizer.email, phone: organizer.phone || "+91 6363338238" };
      }
    }

    // --- 2. RESPONSE GENERATION ---
    if (input.match(/\b(hi|hello|hey|greetings|morning|evening|afternoon|yo)\b/)) {
      const name = currentUser ? currentUser.name.split(' ')[0] : '';
      reply = `Hello${name ? ' ' + name : ''}! I'm the EventVault AI. How can I assist you with events, registrations, or supportive teams today?`;
    }
    else if (input.includes('who developed') || input.includes('creator') || input.includes('who made') || input.includes('developer')) {
      reply = "EventVault was developed by <b>Anupama S H</b>, <b>Kedar K D</b> (6th Sem), and <b>Amogh I Y</b> (4th Sem) from the <b>CSE Department</b> at BGMIT.";
    }
    else if (input.includes('supportive team') || (input.includes('supportive') && input.includes('team'))) {
      if (supportiveTeams.length > 0) {
        reply = "We have the following <b>Supportive Teams</b> you can join:<br>" + 
                supportiveTeams.map(t => `- <b>${t.title}</b> (Handling by: ${(t.createdBy || 'bgmitcs034@gmail.com').replace('admin@eventvault.org', 'bgmitcs034@gmail.com')})`).join('<br>') +
                "<br>Click the blue <b>Supportive Teams</b> button on the home page to join!";
      } else {
        reply = "There are currently no active <b>Supportive Teams</b>. Check back later!";
      }
    }

    if (!reply && aiClient) {
      const systemPrompt = `
You are "EventVault AI", the official assistant for BGMIT's Event Management System.
Current Date: ${todayStr}

UPCOMING EVENTS:
${upcomingEvents.length > 0 ? upcomingEvents.map(e => `- ${e.title}: ${e.date} at ${e.time}, Venue: ${e.location}, Cat: ${e.category}, Mode: ${e.teamMode}`).join('\n') : 'No upcoming events.'}

SUPPORTIVE TEAMS (Volunteering groups):
${supportiveTeams.length > 0 ? supportiveTeams.map(t => `- ${t.title}: Venue: ${t.location}, Role: ${Array.isArray(t.volunteerRoles) ? t.volunteerRoles.map(r => r.name || 'Volunteer').join(', ') : 'Volunteer'}, Handling by: ${(t.createdBy || 'bgmitcs034@gmail.com').replace('admin@eventvault.org', 'bgmitcs034@gmail.com')}, Description: ${t.description || 'N/A'}`).join('\n') : 'No active supportive teams.'}

${mentionedItem ? `USER IS ASKING ABOUT: ${mentionedItem.title}
- Type: ${mentionedItem.isSupportiveTeam ? 'Supportive Team' : 'General Event'}
- Handling/Organizer: ${organizerInfo.name} (${(organizerInfo.email || 'bgmitcs034@gmail.com').replace('admin@eventvault.org', 'bgmitcs034@gmail.com')})
- Contact: ${organizerInfo.phone || "+91 6363338238"}
- Details: ${mentionedItem.description || 'N/A'}` : ''}

PLATFORM NAVIGATION:
1. Register for Events: Green button -> "Register Now". Requires Email OTP.
2. Join Supportive Teams: Blue outline button -> "Join Team". Requires Email OTP.
3. Swap/Transfer: "My Sign Ups" -> "Transfer / Swap".
4. Certificates: Sent to REGISTERED EMAIL after completion.

INSTRUCTIONS:
- Be concise (2-4 sentences).
- Use <b>...</b> for names/buttons.
- Use <br> for new lines.
- Provided Info: ${organizerInfo.name} (${organizerInfo.email || 'bgmitcs034@gmail.com'}, Contact: ${organizerInfo.phone || "+91 6363338238"}).
`;

      if (aiProvider === 'groq') {
        const completion = await aiClient.chat.completions.create({
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
          model: "llama-3.3-70b-versatile",
        });
        reply = completion.choices[0].message.content;
      } else if (aiProvider === 'anthropic') {
        const result = await aiClient.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: `${systemPrompt}\n\nUser: ${message}` }],
        });
        reply = result.content[0].text;
      }
    }

    if (!reply) {
      reply = "I'm sorry, I'm having trouble processing that right now. I can help with event info, registration, certificates, and more. Could you please contact <b>bgmitcs034@gmail.com</b>?";
    }

  } catch (err) {
    console.error('Chat error:', err);
    reply = "I'm experiencing a bit of a glitch. Please try again in a moment!";
  }

  res.json({ reply });
});

module.exports = router;
