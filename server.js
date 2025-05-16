require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

// === Middleware Setup ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Rate Limiting ===
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many submissions. Please try again later.',
});
app.use('/submit-form', limiter);

// === Utility: Email Validator ===
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// === POST Handler for Contact Form ===
app.post('/submit-form', async (req, res) => {
  const { name, email, subject, message, honeypot } = req.body;

  // === Honeypot anti-spam trap ===
  if (honeypot && honeypot.trim() !== '') {
    return res.status(400).json({ error: 'Spam detected.' });
  }

  // === Input Validation ===
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, Email, and Message are required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (!process.env.DISCORD_WEBHOOK || !process.env.DISCORD_WEBHOOK.startsWith('https://')) {
    return res.status(500).json({ error: 'Invalid or missing Discord webhook URL in environment variables.' });
  }

  // === Format Message Content ===
  const timestamp = new Date().toLocaleString();
  const content = `
📩 **New Contact Submission**
**Name:** ${name}
**Email:** ${email}
**Subject:** ${subject || '(No subject)'}
**Message:** ${message}
🕒 **Sent At:** ${timestamp}
  `;

  // === Send to Discord Webhook ===
  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (response.ok) {
      res.status(200).json({ message: 'Message sent successfully!' });
    } else {
      const error = await response.text();
      res.status(500).json({ error: 'Failed to send to Discord: ' + error });
    }
  } catch (err) {
    console.error('Error sending to Discord:', err);
    res.status(500).json({ error: 'Server error. Try again later.' });
  }
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
