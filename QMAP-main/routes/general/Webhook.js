const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { default: mongoose } = require("mongoose");
const TemporaryDepositModel = require("../../models/wallet/TemporaryDeposit.model");
// percentagePrice no longer used for charges here; charges come from env
const BalanceModel = require("../../models/wallet/Balance.model");
const AdminBalanceModel = require("../../models/wallet/admin/AdminBalance.model");
const TransactionsModel = require("../../models/wallet/Transactions.model");
const ProfileModel = require("../../models/user/Profile.model");
const AdminTransactionsModel = require("../../models/wallet/admin/AdminTransactions.model");
const { createNotification } = require("../../utils/Notifications.utils");
const secret = process.env.PaystackSecret;

// paystack

router.post("/paystack", async function (req, res) {
  const allowedIPs = [
    process.env.paystackIP1,
    process.env.paystackIP2,
    process.env.paystackIP3,
  ].filter((ip) => ip); // Ensure no undefined IPs
  const normalizeIP = (ip) => (ip.startsWith("::ffff:") ? ip.substring(7) : ip);
  const clientIP = normalizeIP(
    (req.headers["x-forwarded-for"] || req.connection.remoteAddress || "")
      .split(",")[0]
      .trim()
  );

  console.log("Client IP:", clientIP);
  console.log("Allowed IPs:", allowedIPs);

  // If allowed IPs are configured, enforce them; otherwise skip IP restriction (useful for dev)
  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    return res.status(403).send("Forbidden");
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash == req.headers["x-paystack-signature"]) {
    try {
      // Retrieve the request's body
      const event = req.body;

      if (event.event == "charge.success") {
        //data
        let data = event.data;
        console.log("event11111: ", data);

        //get temporary transaction ref
        let TempTransaction = await TemporaryDepositModel.findOneAndDelete({ _id: data.reference });

        if (!TempTransaction) {
          // Nothing to process
          return res.status(200).send('No temporary transaction found');
        }

        let charges = Number(process.env.chargesdeposit) || 0;

        const fees = data.fees ? Number(data.fees) / 100 : 0;
        const creditedAmount = data.amount / 100 - (Number(charges) + fees);

        //update user balance (create if not exists)
        let newBalance = await BalanceModel.findOneAndUpdate(
          { UserID: TempTransaction.UserId },
          {
            $inc: { Balance: creditedAmount },
            $setOnInsert: { UserID: TempTransaction.UserId, TypeOf: TempTransaction.TypeOf },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        //update admin balance
        await AdminBalanceModel.updateOne({}, {
          $inc: {
            TotalClientFunds: creditedAmount,
            EarnedBalance: charges,
          },
        });

        //create user transactions
        await TransactionsModel.create([
          {
            WalletID: newBalance._id,
            UserId: TempTransaction.UserId,
            TransRef: data.reference,
            Amount: data.amount / 100,
            Title: `Deposit funds via ${data.channel}`,
            Charges: charges,
            Type: "Credit",
            Process: "Success",
            TypeOf: TempTransaction.TypeOf,
          },
        ]);

        //user details
        let user = await ProfileModel.findOne({ _id: TempTransaction.UserId, type: TempTransaction.TypeOf });

        //create admin transaction
        await AdminTransactionsModel.create([
          {
            UserId: TempTransaction.UserId,
            Amount: charges,
            Description: `Charges credited to Earnings:${user.FullName} just deposited ${data.amount / 100} through paystack(${data.channel}) with ref(${data.reference}).`,
            Amount: charges,
            Type: "Credit",
            Process: "Success",
          },
        ]);

        //success end task
        res.send(200);

        //create notication
        const notificationMessage = `Dear ${user.FullName} you have successfully deposited ₦${creditedAmount} into your account.`;
        await createNotification(user._id, notificationMessage);

        // send email here
        return;
      } else if (event.event == "transfer.success") {
        //data
        let data = event.data;

  //get transaction and mark success
  let Transaction = await TransactionsModel.findOneAndUpdate({ _id: data.reference }, { Process: "Success" });

        let charges = Transaction.Charges;

  //update user balance (no-op here, transaction already created earlier)
  await BalanceModel.findOne({ UserID: Transaction.UserId });

        //update admin balance
  await AdminBalanceModel.updateOne({}, { $inc: { EarnedBalance: charges } });

        //update admin transaction
        await AdminTransactionsModel.updateOne({ ref: Transaction._id }, { Process: "Success" });

        //user details
        let user = await ProfileModel.findOne({
          _id: Transaction.UserId,
          type: Transaction.TypeOf,
        });

        //success end task
        res.send(200);

        //create notication
        const notificationMessage = `Dear ${user.FullName} you have successfully withdrawn ₦${Transaction.Amount} from your account.`;
        await createNotification(user._id, notificationMessage);

        // send email here
        return;
      } else if (event.event == "transfer.failed") {
        //data
        let data = event.data;

  //mark transaction failed
  let Transaction = await TransactionsModel.findOneAndUpdate({ _id: data.reference }, { Process: "Failed" });

        let charges = Transaction.Charges;

  //update user balance
  let Balance = await BalanceModel.findOneAndUpdate({ UserID: Transaction.UserId }, { $inc: { Balance: Transaction.Amount } });

        //update admin balance
  await AdminBalanceModel.updateOne({}, { $inc: { EarnedBalance: -charges } });

  //update admin transaction
  await AdminTransactionsModel.updateOne({ ref: Transaction._id }, { Process: "Failed" });

  //user details
  let user = await ProfileModel.findOne({ _id: Transaction.UserId, type: Transaction.TypeOf });

  //success end task
  res.send(200);

  //create notication
  const notificationMessage = `Ooopss!! your withdrawal of ₦${Transaction.Amount} failed.`;
  await createNotification(user._id, notificationMessage);

  // send email here
  return;
      } else if (event.event == "transfer.reversed") {
        //data
        let data = event.data;

        //get temporary transaction ref
  let Transaction = await TransactionsModel.findOneAndUpdate({ _id: data.reference }, { Process: "Failed" });

        let charges = Transaction.Charges;

  let Balance = await BalanceModel.findOneAndUpdate({ UserID: Transaction.UserId }, { $inc: { Balance: Transaction.Amount } });

        //update admin balance
  await AdminBalanceModel.updateOne({}, { $inc: { EarnedBalance: -charges } });

        //update admin transaction
  await AdminTransactionsModel.updateOne({ ref: Transaction._id }, { Process: "Failed" });

        //user details
  let user = await ProfileModel.findOne({ _id: Transaction.UserId, type: Transaction.TypeOf });

  //success end task
  // finished

  res.send(200);

  //create notication
  const notificationMessage = `Ooopss!! your withdrawal of ₦${Transaction.Amount} failed.`;
  await createNotification(user._id, notificationMessage);

  // send email here
  return;
      } else {
        res.send(402);
        return;
      }
    } catch (error) {
      console.log(error);
      res.send(402);
    }
  } else {
    res.send(400);
  }
});

module.exports = router;
