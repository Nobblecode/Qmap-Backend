const express = require('express');
const { Sendmail } = require('../../../utils/Mailer.utils');
const router = express.Router();

// POST /general/contact
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ Access: true, Error: 'name, email and message are required' });
    }

    // basic validation
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ Access: true, Error: 'invalid email address' });
    }

    // prepare HTML body for the company email
    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `;

    const to = process.env.email; // send to company email configured in env
    const subject = `Contact form message from ${name}`;

    const mailRes = await Sendmail(to, subject, html);

    if (mailRes && mailRes.sent) {
      return res.json({ Access: true, Message: 'Message sent successfully' });
    }

    return res.status(500).json({ Access: true, Error: mailRes.error || 'Failed to send message' });
  } catch (error) {
    console.error('Contact endpoint error:', error);
    return res.status(500).json({ Access: true, Error: error.message || 'Server error' });
  }
});

module.exports = router;
