const express = require("express");
const router = express.Router();
const BalanceModel = require("../../../models/wallet/Balance.model");
const { Errordisplay } = require("../../../utils/Auth.utils");

// Public (or admin) endpoint to list wallet balances per user (use carefully)
router.get("/all", async (req, res) => {
  try {
    const balances = await BalanceModel.find().populate('UserID');

    const result = balances.map((b) => ({
      user: b.UserID,
      balance: b.Balance,
      type: b.TypeOf,
    }));

    return res.json({ Access: true, balances: result });
  } catch (error) {
    return res.status(400).json({ Access: false, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
