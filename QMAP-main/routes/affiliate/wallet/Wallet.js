const express = require("express");
const {
  VerifyAffilliateMarketerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const router = express.Router();

// Get authenticated affiliate's wallet balance and transactions
router.get("/", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  try {
    const balance = await BalanceModel.findOne({
      UserID: req.user._id,
      TypeOf: "Affiliate",
    });

    const transactions = await TransactionsModel.find({
      UserId: req.user._id,
      TypeOf: "Affiliate",
    }).sort({ createdAt: -1 });

    return res.json({
      Access: true,
      Balance: balance ? balance.Balance : 0,
      Transactions: transactions,
    });
  } catch (error) {
    console.log({ error });
    return res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
