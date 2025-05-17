require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Rate Limiting Middleware ===
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit per IP
  message: 'Too many submissions. Please wait a minute and try again.',
});
app.use('/submit-form', limiter);

// === Utility: Validate Email Format ===
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// === POST Route: /submit-form ===
app.post('/submit-form', async (req, res) => {
  const { name, email, subject, message, honeypot } = req.body;

  // === Anti-spam honeypot check ===
  if (honeypot && honeypot.trim() !== '') {
    return res.status(400).json({ error: 'Spam detected.' });
  }

  // === Required Fields Check ===
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, Email, and Message are required.' });
  }

  // === Validate Email Format ===
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // === Check for Discord Webhook Configuration ===
  const webhookURL = process.env.DISCORD_WEBHOOK;
  if (!webhookURL || !webhookURL.startsWith('https://')) {
    return res.status(500).json({ error: 'Discord webhook is missing or invalid in environment variables.' });
  }

  // === Build Discord Message ===
  const timestamp = new Date().toLocaleString();
  const discordMessage = {
    content: `
📬 **New Contact Form Submission**
**Name:** ${name}
**Email:** ${email}
**Subject:** ${subject || '(No subject)'}
**Message:** ${message}
🕒 **Submitted at:** ${timestamp}
    `
  };

  // === Send to Discord Webhook ===
  try {
    const discordResponse = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
    });

    if (discordResponse.ok) {
      return res.status(200).json({ message: '✅ Message sent successfully!' });
    } else {
      const errText = await discordResponse.text();
      return res.status(502).json({ error: 'Failed to send to Discord: ' + errText });
    }
  } catch (err) {
    console.error('❌ Error posting to Discord:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// === Start the Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
