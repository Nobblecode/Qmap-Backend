const express = require("express");
const axios = require("axios");
const {
  VerifyAffilliateMarketerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const TemporaryDepositModel = require("../../../models/wallet/TemporaryDeposit.model");
const router = express.Router();
const { default: mongoose } = require("mongoose");
const BalanceModel = require("../../../models/wallet/Balance.model");
const AdminBalanceModel = require("../../../models/wallet/admin/AdminBalance.model");
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const ProfileModel = require("../../../models/user/Profile.model");
const AdminTransactionsModel = require("../../../models/wallet/admin/AdminTransactions.model");
const { createNotification } = require("../../../utils/Notifications.utils");
const crypto = require('crypto');

// paystack
router.post("/initialize", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  try {
  const { Amount, ReturnUrl } = req.body;

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
    const token = crypto.randomBytes(18).toString('hex');
    const tempTransaction = await TemporaryDepositModel.create({
      UserId: req.user._id,
      Amount,
      TypeOf: "Affiliate",
      ReturnUrl: ReturnUrl || null,
      VerifyToken: token,
    });

    // Build a reliable callback_url for Paystack initialization.
    let callbackBase = process.env.APP_BASE_URL;
    try {
      if (!callbackBase && tempTransaction.ReturnUrl) {
        const u = new URL(tempTransaction.ReturnUrl);
        callbackBase = u.origin;
      }
    } catch (e) {
      // ignore invalid ReturnUrl and fallback to request origin below
    }
    if (!callbackBase) {
      const proto = req.headers["x-forwarded-proto"] || req.protocol || 'http';
      callbackBase = `${proto}://${req.get('host')}`;
    }

    const callbackUrl = `${callbackBase.replace(/\/$/, '')}/payment-return?reference=${tempTransaction._id}${
      tempTransaction.ReturnUrl ? `&returnUrl=${encodeURIComponent(tempTransaction.ReturnUrl)}` : ''
    }&token=${token}`;

    const integrationResponse = (
      await axios({
        url: "https://api.paystack.co/transaction/initialize",
        method: "post",
        headers: {
          Authorization: `Bearer ${process.env.PaystackSecret}`,
          "Content-Type": "application/json",
        },
        data: {
          amount: tempTransaction.Amount * 100,
          email: req.user.Email,
          reference: tempTransaction._id,
          callback_url: callbackUrl,
          channels: [
            "card",
            "bank",
            "ussd",
            "qr",
            "mobile_money",
            "bank_transfer",
            "eft",
          ],
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

// Verify payment (use instead of webhook if desired)
router.post("/verify", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ Access: true, Error: 'reference is required' });

    // verify transaction at Paystack
    const verifyRes = (await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PaystackSecret}` }
    })).data;

    if (!verifyRes || !verifyRes.data || verifyRes.data.status !== 'success') {
      return res.status(400).json({ Access: true, Error: 'Payment not successful' });
    }

    const data = verifyRes.data; // contains amount, reference, fees, channel

    try {
      // Atomically retrieve and remove the temporary transaction to prevent double-processing
      const TempTransaction = await TemporaryDepositModel.findOneAndDelete({ _id: reference, UserId: req.user._id });
      if (!TempTransaction) {
        return res.status(404).json({ Access: true, Error: 'Temporary transaction not found or already processed' });
      }
      const storedReturnUrl = TempTransaction.ReturnUrl || null;

  const fees = data.fees ? Number(data.fees) / 100 : 0;
  const platformCharges = Number(process.env.chargesdeposit) || 0;
  const creditedAmount = data.amount / 100;

      // update or create user balance (safe arithmetic)
      const newBalance = await BalanceModel.findOneAndUpdate(
        { UserID: TempTransaction.UserId },
        {
          $inc: { Balance: creditedAmount },
          $setOnInsert: { UserID: TempTransaction.UserId, TypeOf: TempTransaction.TypeOf }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // update admin balance
      await AdminBalanceModel.updateOne({}, {
        $inc: {
          TotalClientFunds: creditedAmount,
          EarnedBalance: 0
        }
      });

      // create user transaction
      await TransactionsModel.create([
        {
          WalletID: newBalance._id,
          UserId: TempTransaction.UserId,
          TransRef: data.reference,
          Amount: data.amount / 100,
          Title: `Deposit funds via ${data.channel}`,
           Charges: 0,
          Type: 'Credit',
          Process: 'Success',
          TypeOf: TempTransaction.TypeOf
        }
      ]);

      // user details
      const user = await ProfileModel.findOne({ _id: TempTransaction.UserId, type: TempTransaction.TypeOf });

      // create admin transaction
      if (platformCharges > 0) {
        await AdminTransactionsModel.create([
          {
            UserId: TempTransaction.UserId,
            Amount: platformCharges,
            Description: `Charges credited to Earnings:${user ? user.FullName : ''} deposited ${data.amount / 100} through paystack(${data.channel}) with ref(${data.reference}).`,
            Type: 'Credit',
            Process: 'Success',
          }
        ]);
      }

      // send notification (no await blocking)
      if (user) createNotification(user._id, `Dear ${user.FullName}, you have successfully deposited ₦${creditedAmount} into your account.`).catch(()=>{});

      return res.json({ Access: true, Message: 'Payment verified and balance updated', ReturnUrl: storedReturnUrl });
    } catch (err) {
      throw err;
    }
  } catch (error) {
    return res.status(400).json({ Access: true, Error: error.message || 'Verification failed' });
  }
});

// Public verify using reference + token (for cases where user is redirected and not authenticated)
router.post('/verify-public', async (req, res) => {
  try {
    console.log('Verifying...');
    const { reference, token } = req.body;
    if (!reference || !token) return res.status(400).json({ Access: true, Error: 'reference and token required' });

    // proceed to verify at paystack
    const verifyRes = (await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PaystackSecret}` }
    })).data;

    if (!verifyRes || !verifyRes.data || verifyRes.data.status !== 'success') {
      return res.status(400).json({ Access: true, Error: 'Payment not successful' });
    }

    const data = verifyRes.data;

    try {
      // Atomically retrieve and remove temp transaction to prevent duplicate processing
      const TempTransaction = await TemporaryDepositModel.findOneAndDelete({ _id: reference, VerifyToken: token });
      if (!TempTransaction) return res.status(404).json({ Access: true, Error: 'Temporary transaction not found or already processed' });

  const fees = data.fees ? Number(data.fees) / 100 : 0;
  const platformCharges = Number(process.env.chargesdeposit) || 0;
  const creditedAmountPublic = data.amount / 100;

      // update or create user balance
      const newBalance = await BalanceModel.findOneAndUpdate(
        { UserID: TempTransaction.UserId },
        {
          $inc: { Balance: creditedAmountPublic },
          $setOnInsert: { UserID: TempTransaction.UserId, TypeOf: TempTransaction.TypeOf }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await AdminBalanceModel.updateOne({}, {
        $inc: {
          TotalClientFunds: creditedAmountPublic,
          EarnedBalance: 0
        }
      });

      await TransactionsModel.create([{
        WalletID: newBalance._id,
        UserId: TempTransaction.UserId,
        TransRef: data.reference,
        Amount: data.amount / 100,
        Title: `Deposit funds via ${data.channel}`,
         Charges: 0,
        Type: 'Credit',
        Process: 'Success',
        TypeOf: TempTransaction.TypeOf
      }]);

      const user = await ProfileModel.findOne({ _id: TempTransaction.UserId, type: TempTransaction.TypeOf });

      if (platformCharges > 0) {
        await AdminTransactionsModel.create([{
          UserId: TempTransaction.UserId,
          Amount: platformCharges,
          Description: `Charges credited to Earnings:${user ? user.FullName : ''} deposited ${data.amount / 100} through paystack(${data.channel}) with ref(${data.reference}).`,
          Type: 'Credit',
          Process: 'Success'
        }]);
      }

      // delete temp
      await TemporaryDepositModel.deleteOne({ _id: reference, VerifyToken: token });

      if (user) createNotification(user._id, `Dear ${user.FullName}, you have successfully deposited ₦${creditedAmountPublic} into your account.`).catch(()=>{});

      return res.json({ Access: true, Message: 'Payment verified and balance updated', ReturnUrl: TempTransaction.ReturnUrl || null });
    } catch (err) {
      console.log({ err });
      throw err;
    }
  } catch (error) {
    console.log({ error });
    return res.status(400).json({ Access: true, Error: error.message || 'Verification failed' });
  }
});

// Public endpoint to check deposit status by reference
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ Access: true, Error: 'reference required' });
    const temp = await TemporaryDepositModel.findById(reference).lean();
    if (temp) {
      return res.json({ Access: true, pending: true, ReturnUrl: temp.ReturnUrl || null });
    }
    // if temp not found, assume processed
    return res.json({ Access: true, pending: false });
  } catch (err) {
    return res.status(500).json({ Access: true, Error: err.message });
  }
});

module.exports = router;
