const express = require("express");
const {
  VerifyProductOwnerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const router = express.Router();

// Get authenticated product owner's wallet balance and transactions
router.get("/", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const balance = await BalanceModel.findOne({
      UserID: req.user._id,
      TypeOf: "Product Owner",
    });

    const transactions = await TransactionsModel.find({
      UserId: req.user._id,
      TypeOf: "Product Owner",
    }).sort({ createdAt: -1 });

    console.log({ balance, transactions });

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
