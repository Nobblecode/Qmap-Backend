const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { default: mongoose } = require("mongoose");
const TemporaryDepositModel = require("../../models/wallet/TemporaryDeposit.model");
const { percentagePrice } = require("../../utils/Random.utils");
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

  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).send("Forbidden");
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash == req.headers["x-paystack-signature"]) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Retrieve the request's body
      const event = req.body;

      if (event.event == "charge.success") {
        //data
        let data = event.data;
        console.log("event11111: ", data);

        //get temporary transaction ref
        let TempTransaction = await TemporaryDepositModel.findOneAndDelete({
          _id: data.reference,
        }).session(session);

        console.log("Temp111111: ", TempTransaction);

        let charges = percentagePrice(
          data.amount / 100,
          process.env.chargesdeposit
        );

        //update user balance
        let newBalance = await BalanceModel.findOneAndUpdate(
          { UserID: TempTransaction.UserId },
          {
            $inc: {
              Balance:
                data.amount / 100 - (Number(charges) + Number(data.fees) / 100),
            },
          }
        ).session(session);

        //update admin balance
        await AdminBalanceModel.updateOne(
          {},
          {
            $inc: {
              TotalClientFunds:
                data.amount / 100 - (Number(charges) + Number(data.fees) / 100),
              EarnedBalance: charges,
            },
          }
        ).session(session);

        //create user transactions
        await TransactionsModel.create(
          [
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
          ],
          { session: session }
        );

        //user details
        let user = await ProfileModel.findOne({
          _id: TempTransaction.UserId,
          type: TempTransaction.TypeOf,
        }).session(session);

        //create admin transaction
        await AdminTransactionsModel.create(
          [
            {
              UserId: TempTransaction.UserId,
              Amount: charges,
              Description: `Charges credited to Earnings:${
                user.FullName
              } just deposited ${data.amount / 100} through paystack(${
                data.channel
              }) with ref(${data.reference}).`,
              Amount: charges,
              Type: "Credit",
              Process: "Success",
            },
          ],
          { session: session }
        );

        //success end task
        await session.commitTransaction();
        session.endSession();

        res.send(200);

        //create notication
        const notificationMessage = `Dear ${
          user.FullName
        } you have successfully deposited ₦${
          data.amount / 100 - (Number(charges) + Number(data.fees) / 100)
        } into your account.`;
        await createNotification(user._id, notificationMessage);

        // send email here
        return;
      } else if (event.event == "transfer.success") {
        //data
        let data = event.data;

        //get temporary transaction ref
        let Transaction = await TransactionsModel.findOneAndUpdate(
          { _id: data.reference },
          { Process: "Success" }
        ).session(session);

        let charges = Transaction.Charges;

        //update user balance
        await BalanceModel.findOne({
          UserID: Transaction.UserId,
        }).session(session);

        //update admin balance
        await AdminBalanceModel.updateOne(
          {},
          { $inc: { EarnedBalance: charges } }
        ).session(session);

        //update admin transaction
        await AdminTransactionsModel.updateOne(
          { ref: Transaction._id },
          { Process: "Success" }
        ).session(session);

        //user details
        let user = await ProfileModel.findOne({
          _id: Transaction.UserId,
          type: Transaction.TypeOf,
        }).session(session);

        //success end task
        await session.commitTransaction();
        session.endSession();

        res.send(200);

        //create notication
        const notificationMessage = `Dear ${user.FullName} you have successfully withdrawn ₦${Transaction.Amount} from your account.`;
        await createNotification(user._id, notificationMessage);

        // send email here
        return;
      } else if (event.event == "transfer.failed") {
        //data
        let data = event.data;

        //get temporary transaction ref
        let Transaction = await TransactionsModel.findOneAndUpdate(
          { _id: data.reference },
          { Process: "Failed" }
        ).session(session);

        let charges = Transaction.Charges;

        //update user balance
        let Balance = await BalanceModel.findOneAndUpdate(
          { UserID: Transaction.UserId },
          { $inc: { Balance: Transaction.Amount } }
        ).session(session);

        //update admin balance
        await AdminBalanceModel.updateOne(
          {},
          { $inc: { EarnedBalance: -charges } }
        ).session(session);

        //update admin transaction
        await AdminTransactionsModel.updateOne(
          { ref: Transaction._id },
          { Process: "Failed" }
        ).session(session);

        //user details
        let user = await ProfileModel.findOne({
          _id: Transaction.UserId,
          type: Transaction.TypeOf,
        }).session(session);

        //success end task
        await session.commitTransaction();
        session.endSession();

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
        let Transaction = await TransactionsModel.findOneAndUpdate(
          { _id: data.reference },
          { Process: "Failed" }
        ).session(session);

        let charges = Transaction.Charges;

        //update user balance
        let Balance = await BalanceModel.findOneAndUpdate(
          { UserID: Transaction.UserId },
          { $inc: { Balance: Transaction.Amount } }
        ).session(session);

        //update admin balance
        await AdminBalanceModel.updateOne(
          {},
          { $inc: { EarnedBalance: -charges } }
        ).session(session);

        //update admin transaction
        await AdminTransactionsModel.updateOne(
          { ref: Transaction._id },
          { Process: "Failed" }
        ).session(session);

        //user details
        let user = await ProfileModel.findOne({
          _id: Transaction.UserId,
          type: Transaction.TypeOf,
        }).session(session);

        //success end task
        await session.commitTransaction();
        session.endSession();

        res.send(200);

        //create notication
        const notificationMessage = `Ooopss!! your withdrawal of ₦${Transaction.Amount} failed.`;
        await createNotification(user._id, notificationMessage);

        // send email here
        return;
      } else {
        res.send(402);
        await session.abortTransaction();
        session.endSession();
        return;
      }
    } catch (error) {
      console.log(error);
      res.send(402);
      await session.abortTransaction();
      session.endSession();
    }
  } else {
    res.send(400);
  }
});

module.exports = router;
