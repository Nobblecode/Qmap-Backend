const express = require("express");
const axios = require("axios");
const { default: mongoose } = require("mongoose");
const {
  VerifyProductOwnerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const { GenOTP } = require("../../../utils/Tokens.utils");
const OtpModel = require("../../../models/user/auth/Otp.model");
const TemporaryWithdrawalModel = require("../../../models/wallet/TemporaryWithdrawal.model");
const ProfileModel = require("../../../models/user/Profile.model");
const { percentagePrice } = require("../../../utils/Random.utils");
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const AdminTransactionsModel = require("../../../models/wallet/admin/AdminTransactions.model");
const FailedTransactionsModel = require("../../../models/wallet/FailedTransactions.model");
const router = express.Router();

router.post("/sendOtp", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    let Email = req.user.Email;

    // if (Type === "Seller") {
    // }

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
      TypeOf: "Product Owner",
    });

    // find owner
    let owner = await ProfileModel.findOne({ _id: req.user._id });

    // send mail
    // await Sendmail(
    //   owner.Email,
    //   "Verify your withdrawal",
    //   `
    //       <!DOCTYPE html>
    //       <html lang="en">
    //       <head>
    //           <meta charset="UTF-8">
    //           <meta name="viewport" content="width=device-width, initial-scale=1.0">
    //           <meta http-equiv="X-UA-Compatible" content="IE=edge">
    //           <style>
    //               body {
    //                   margin: 0;
    //                   padding: 0;
    //                   background-color: #f2f2f2;
    //                   font-family: Arial, sans-serif;
    //               }
    //               table {
    //                   border-spacing: 0;
    //               }
    //               td {
    //                   padding: 0;
    //               }
    //               img {
    //                   border: 0;
    //               }
    //               .email-container {
    //                   width: 100%;
    //                   max-width: 600px;
    //                   margin: 0 auto;
    //                   background-color: #ffffff;
    //                   border-radius: 8px;
    //                   overflow: hidden;
    //                   box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    //               }
    //               .header {
    //                   background-color: #4CAF50;
    //                   color: #ffffff;
    //                   text-align: center;
    //                   padding: 20px;
    //               }
    //               .header h1 {
    //                   margin: 0;
    //               }
    //               .content {
    //                   padding: 20px;
    //                   color: #333333;
    //                   text-align: center;
    //               }
    //               .content h2 {
    //                   color: #4CAF50;
    //                   margin-top: 0;
    //               }
    //               .otp {
    //                   display: inline-block;
    //                   padding: 10px 20px;
    //                   background-color: #4CAF50;
    //                   color: #ffffff;
    //                   font-size: 24px;
    //                   font-weight: bold;
    //                   border-radius: 5px;
    //                   margin: 20px 0;
    //                   letter-spacing: 2px;
    //               }
    //               .footer {
    //                   background-color: #f9f9f9;
    //                   text-align: center;
    //                   padding: 10px;
    //                   font-size: 12px;
    //                   color: #777777;
    //               }
    //               .footer p {
    //                   margin: 5px 0;
    //               }
    //               .footer a {
    //                   color: #4CAF50;
    //                   text-decoration: none;
    //               }
    //               @media (max-width: 600px) {
    //                   .email-container {
    //                       width: 100% !important;
    //                   }
    //               }
    //           </style>
    //       </head>
    //       <body>
    //           <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f2f2f2;">
    //               <tr>
    //                   <td>
    //                       <table class="email-container" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    //                           <!-- Header -->
    //                           <tr>
    //                               <td class="header">
    //                                   <h1>Cashrole</h1>
    //                                   <p>Your Business, Our Priority</p>
    //                               </td>
    //                           </tr>
    //                           <!-- Content -->
    //                           <tr>
    //                               <td class="content">
    //                                   <h2>Verify Your Withdrawal</h2>
    //                                   <p>To complete your withdrawal, please enter the OTP code below to verify you're the one.</p>
    //                                   <div class="otp">${Otp}</div>
    //                                   <p>If you didn't request this, please ignore this email or contact our support.</p>
    //                               </td>
    //                           </tr>
    //                           <!-- Footer -->
    //                           <tr>
    //                               <td class="footer">
    //                                   <p>&copy; ${process.env.mailDate} Cashrole. All rights reserved.</p>
    //                                   <p><a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></p>
    //                               </td>
    //                           </tr>
    //                       </table>
    //                   </td>
    //               </tr>
    //           </table>
    //       </body>
    //       </html>

    //       `
    // );

    res.json({ Access: true, Error: false, Sent: true, Otp: Otp });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// paystack
router.post("/withdraw", VerifyProductOwnerJWTToken, async (req, res) => {
  let walletidFailed = "nan";
  let AmountFailed = 0;
  let ChargesFailed = 0;
  let AdminTransactionIdFailed = "";
  let transactionIDFailed = "";
  //   console.log("about to start");
  try {
    // verify otp
    // inputs
    let Otp = req.body.OTP;
    // check otp
    let FindOtp = await OtpModel.findOneAndDelete({
      UserID: req.user._id,
      OTP: Otp,
    });
    if (!FindOtp)
      return res.status(404).json({ Access: true, Error: "Incorrect Otp" });

    console.log("past otp");

    // find details
    const body = await TemporaryWithdrawalModel.findOne({
      UserId: req.user._id,
    });

    if (!body)
      return res
        .status(400)
        .json({ Access: true, Error: "Pls restart withdrawal process" });

    AmountFailed = body.Amount;

    console.log("past details");

    // Step 1: Create or verify transfer recipient
    const recipientResponse = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: body.AccountName, // Replace with the actual user name
        account_number: body.AccountNumber,
        bank_code: body.Bank,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PaystackSecret}`, // Use your secret key
          "Content-Type": "application/json",
        },
      }
    );

    console.log("past recipient response");

    const recipientCode = recipientResponse.data.data.recipient_code;

    // find user balance
    const userBalance = await BalanceModel.findOne({ UserID: req.user._id });
    walletidFailed = userBalance._id;

    // charges
    let charges = percentagePrice(
      body.Amount / 100,
      process.env.WithdrawalCharges
    );
    ChargesFailed = charges;

    // create user transaction
    let Transaction = await TransactionsModel.create({
      WalletID: userBalance._id,
      UserId: req.user._id,
      Amount: body.Amount,
      Title: "Withdraw Funds",
      Charges: charges,
      Type: "Debit",
      Process: "Pending",
      TypeOf: "Product Owner",
    });
    transactionIDFailed = Transaction._id;

    // create admin transaction
    let transactionAdmin = await AdminTransactionsModel.create({
      UserId: req.user._id,
      Amount: charges,
      Description: `Product Owner Withdrew funds: ${req.user.FullName} just withdrew NGN${body.Amount}. NGN${charges} Charges just credited.`,
      Type: "Credit",
      Process: "Pending",
      ref: Transaction._id,
    });
    AdminTransactionIdFailed = transactionAdmin._id;

    console.log("created all transactions");

    // Step 2: Initiate transfer
    const transferResponse = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: body.Amount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: "Withdrawal",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PaystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("transfer response");

    // Respond with success
    res.status(200).json({
      Access: true,
      Error: false,
      Withdrawn: true,
      Data: transferResponse.data.data,
    });
  } catch (error) {
    if (error instanceof mongoose.Error || error.name === "MongoError") {
      res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
    } else {
      console.log(error.response || error.response.data);

      await FailedTransactionsModel.create({
        WalletID: walletidFailed,
        UserId: req.user._id,
        Amount: AmountFailed,
        Title: `Withdrawal failure: ${Errordisplay(error).msg}`,
        Charges: ChargesFailed,
        TransactionId: transactionIDFailed,
        AdminTransactionId: AdminTransactionIdFailed,
      });

      // update client transaction
      await TransactionsModel.findOneAndUpdate(
        { _id: transactionIDFailed },
        { Process: "Failed" }
      );

      //update admin transaction
      await AdminTransactionsModel.updateOne(
        { _id: AdminTransactionIdFailed },
        { Process: "Failed" }
      );

      return res.status(500).json({
        Access: true,
        Error: `Could not withdraw(${
          Errordisplay(error).msg
        }). Contact admin...`,
      });
    }
  }
});

module.exports = router;
