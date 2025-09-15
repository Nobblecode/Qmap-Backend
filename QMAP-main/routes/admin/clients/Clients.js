const express = require('express');
const router = express.Router();
const { VerifyAdminJWTToken, Errordisplay } = require('../../../utils/Auth.utils');
const ProfileModel = require('../../../models/user/Profile.model');
const BalanceModel = require('../../../models/wallet/Balance.model');

// List clients (optionally filter by type via ?type=Product Owner)
router.get('/', VerifyAdminJWTToken, async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type;

    const clients = await ProfileModel.find(filter).select('-Password').lean();
    return res.json({ Access: true, clients });
  } catch (error) {
    return res.status(400).json({ Access: false, Error: Errordisplay(error).msg });
  }
});

// Add client (admin creates a user)
router.post('/', VerifyAdminJWTToken, async (req, res) => {
  try {
    const { FullName, Email, Password, type } = req.body;
    if (!FullName || !Email || !Password || !type) return res.status(400).json({ Access: false, Error: 'Missing fields' });

    const newClient = await ProfileModel.create({ FullName, Email, Password, type });

    // if product owner, create initial balance document
    if (type === 'Product Owner') {
      await BalanceModel.create({ UserID: String(newClient._id), Balance: 0, TypeOf: 'Product Owner', Earned: 0, Reserved: 0 });
    }

    const client = await ProfileModel.findOne({ _id: newClient._id }).select('-Password').lean();

    return res.json({ Access: true, client });
  } catch (error) {
    return res.status(400).json({ Access: false, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
