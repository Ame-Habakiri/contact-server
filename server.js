require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many submissions. Please try again later.',
});
app.use('/submit-form', limiter);

// Multer setup
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post('/submit-form', upload.single('file'), async (req, res) => {
  const { name, email, subject, message, honeypot } = req.body;

  if (honeypot && honeypot.trim() !== '') {
    return res.status(400).json({ error: 'Spam detected' });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const file = req.file;
  const fileUrl = file ? `${req.protocol}://${req.get('host')}/uploads/${file.filename}` : 'None';

  const content = `
📩 **New Contact Form Submission**
**Name:** ${name}
**Email:** ${email}
**Subject:** ${subject || '(No subject)'}
**Message:** ${message}
📎 **Attachment:** ${file ? `[Download File](${fileUrl})` : 'None'}
🕒 **Sent At:** ${new Date().toLocaleString()}
  `;

  if (!process.env.DISCORD_WEBHOOK) {
    return res.status(500).json({ error: 'Discord webhook URL is not configured.' });
  }

  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (response.ok) {
      res.status(200).json({ message: 'Message sent successfully!' });
    } else {
      res.status(500).json({ error: 'Failed to send to Discord' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
