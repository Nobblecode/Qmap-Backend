const express = require("express");
const axios = require("axios");
const { default: mongoose } = require("mongoose");
const {
  VerifyAffilliateMarketerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const { GenOTP } = require("../../../utils/Tokens.utils");
const OtpModel = require("../../../models/user/auth/Otp.model");
const TemporaryWithdrawalModel = require("../../../models/wallet/TemporaryWithdrawal.model");
const ProfileModel = require("../../../models/user/Profile.model");
const { Sendmail } = require("../../../utils/Mailer.utils");
// withdraw charges now read from env WithdrawalCharges
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const AdminTransactionsModel = require("../../../models/wallet/admin/AdminTransactions.model");
const FailedTransactionsModel = require("../../../models/wallet/FailedTransactions.model");
const router = express.Router();

router.post("/sendOtp", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  try {
    let Email = req.user.Email;

    // inputs
    let { Amount, Bank, AccountNumber, AccountName } = req.body;

    // find user balance
    const userBalance = await BalanceModel.findOne({
      UserID: req.user._id,
    });
    if (!userBalance)
      return res.status(404).json({
        Access: true,
        Error: "User does not have an existing balance!",
      });

    // check amount
    if (Amount > userBalance.Balance)
      return res.status(400).json({
        Access: true,
        Error: "Withdrawal amount is greater than user balance!",
      });

    if (Amount < 1000)
      return res.status(400).json({
        Access: true,
        Error: "Withdrawal amount is too small!",
      });

    if (Amount > 10000000)
      return res.status(400).json({
        Access: true,
        Error: "Withdrawal amount is too big!",
      });

    // generate otp
    let Otp = GenOTP();

    // delete any existing otp
    await OtpModel.deleteOne({
      UserID: req.user._id,
    });

    // save otp
    await OtpModel.create({
      UserID: req.user._id,
      OTP: Otp,
    });

    // delete any existing temporary withdrawal
    await TemporaryWithdrawalModel.deleteOne({
      UserId: req.user._id,
    });

    // create temporary withdrawal
    await TemporaryWithdrawalModel.create({
      UserId: req.user._id,
      Amount: Amount,
      Bank: Bank,
      AccountNumber: AccountNumber,
      AccountName: AccountName,
      TypeOf: "Affiliate",
    });

    // find owner
    let owner = await ProfileModel.findOne({ _id: req.user._id });

    // send mail
    try {
      const html = `
        <p>Dear ${owner.FullName || owner.Email},</p>
        <p>Your withdrawal OTP is: <strong>${Otp}</strong></p>
        <p>If you did not request this, please contact support.</p>
      `;
      Sendmail(owner.Email, 'Verify your withdrawal', html).catch((e) => console.log('Sendmail error', e));
    } catch (mailErr) {
      console.log('Error sending withdrawal OTP email', mailErr);
    }

    res.json({ Access: true, Error: false, Sent: true, Otp: Otp });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// paystack-like withdraw endpoint
router.post("/", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  let walletidFailed = "nan";
  let AmountFailed = 0;
  let ChargesFailed = 0;
  let AdminTransactionIdFailed = "";
  let transactionIDFailed = "";
  try {
    let Otp = req.body.OTP;
    let FindOtp = await OtpModel.findOneAndDelete({
      UserID: req.user._id,
      OTP: Otp,
    });
    if (!FindOtp) return res.status(404).json({ Access: true, Error: "Incorrect Otp" });

    const body = await TemporaryWithdrawalModel.findOne({ UserId: req.user._id });
    if (!body) return res.status(400).json({ Access: true, Error: "Pls restart withdrawal process" });

    AmountFailed = body.Amount;

    const recipientResponse = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: body.AccountName,
        account_number: body.AccountNumber,
        bank_code: body.Bank,
        currency: "NGN",
      },
      {
        headers: { Authorization: `Bearer ${process.env.PaystackSecret}`, "Content-Type": "application/json" },
      }
    );

    const recipientCode = recipientResponse.data.data.recipient_code;

    const userBalance = await BalanceModel.findOne({ UserID: req.user._id });
    walletidFailed = userBalance._id;

    let charges = Number(process.env.WithdrawalCharges) || 0;
    ChargesFailed = charges;

    let Transaction = await TransactionsModel.create({
      WalletID: userBalance._id,
      UserId: req.user._id,
      Amount: body.Amount,
      Title: "Withdraw Funds",
      Charges: charges,
      Type: "Debit",
      Process: "Pending",
      TypeOf: "Affiliate",
    });
    transactionIDFailed = Transaction._id;

    let transactionAdmin = await AdminTransactionsModel.create({
      UserId: req.user._id,
      Amount: charges,
      Description: `Affiliate Withdrew funds: ${req.user.FullName} just withdrew NGN${body.Amount}. NGN${charges} Charges just credited.`,
      Type: "Credit",
      Process: "Pending",
      ref: Transaction._id,
    });
    AdminTransactionIdFailed = transactionAdmin._id;

    await BalanceModel.findOneAndUpdate({ UserID: req.user._id }, { $inc: { Balance: -body.Amount } });

    const transferResponse = await axios.post(
      "https://api.paystack.co/transfer",
      { source: "balance", amount: body.Amount * 100, recipient: recipientCode, reason: "Withdrawal" },
      { headers: { Authorization: `Bearer ${process.env.PaystackSecret}`, "Content-Type": "application/json" } }
    );

    return res.status(200).json({ Access: true, Error: false, Withdrawn: true, Data: transferResponse.data.data });
  } catch (error) {
    if (error instanceof mongoose.Error || error.name === "MongoError") {
      res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
    } else {
      console.log(error.response || error.response.data);
      try {
        if (walletidFailed && AmountFailed) {
          await BalanceModel.findOneAndUpdate({ _id: walletidFailed }, { $inc: { Balance: AmountFailed } });
        }
      } catch (restoreErr) {
        console.log('Error restoring balance after failed withdrawal initiation', restoreErr);
      }

      await FailedTransactionsModel.create({
        WalletID: walletidFailed,
        UserId: req.user._id,
        Amount: AmountFailed,
        Title: `Withdrawal failure: ${Errordisplay(error).msg}`,
        Charges: ChargesFailed,
        TransactionId: transactionIDFailed,
        AdminTransactionId: AdminTransactionIdFailed,
      });

      await TransactionsModel.findOneAndUpdate({ _id: transactionIDFailed }, { Process: "Failed" });
      await AdminTransactionsModel.updateOne({ _id: AdminTransactionIdFailed }, { Process: "Failed" });

      return res.status(500).json({ Access: true, Error: `Could not withdraw(${Errordisplay(error).msg}). Contact admin...` });
    }
  }
});

module.exports = router;
