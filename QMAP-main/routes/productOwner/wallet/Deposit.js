const express = require("express");
const axios = require("axios");
const {
  VerifyProductOwnerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const TemporaryDepositModel = require("../../../models/wallet/TemporaryDeposit.model");
const router = express.Router();

// paystack
router.post("/initialize", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { Amount } = req.body;

    // Check for a valid amount
    if (!Amount || Amount < 1000) {
      return res.status(400).json({
        Access: true,
        Error: "Amount too small",
      });
    }

    // Delete any existing temporary transactions for the user
    await TemporaryDepositModel.deleteOne({
      UserId: req.user._id,
    });

    // Create a new temporary transaction
    const tempTransaction = await TemporaryDepositModel.create({
      UserId: req.user._id,
      Amount,
      TypeOf: "Product Owner",
    });

    // Integrate Paystack for transaction initialization
    const integrationResponse = (
      await axios({
        url: "https://api.paystack.co/transaction/initialize",
        method: "post",
        headers: {
          Authorization: `Bearer ${process.env.PaystackSecret}`, // Ensure this environment variable is set
          "Content-Type": "application/json",
        },
        data: {
          amount: tempTransaction.Amount * 100, // Convert amount to kobo
          email: req.user.Email, // Use authenticated user's email
          reference: tempTransaction._id, // Unique reference ID
          channels: [
            "card",
            "bank",
            "ussd",
            "qr",
            "mobile_money",
            "bank_transfer",
            "eft",
          ], // Payment channels
        },
      })
    ).data;

    // Return the payment link to the client
    return res.json({
      Access: true,
      Error: false,
      PaymentLink: integrationResponse.data.authorization_url,
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
