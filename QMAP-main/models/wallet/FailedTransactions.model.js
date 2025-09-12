const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const FailedTransactions = new Schema(
  {
    WalletID: {
      type: String,
      required: [true, "your WalletID is requred "],
    },
    UserId: {
      type: String,
      required: [true, "your UserId is requred "],
    },
    Amount: {
      type: Number,
      required: [true, "amount is required"],
      default: 0,
      min: [1, "Amount is too small"],
    },
    Title: {
      type: String,
      required: [true, "Transaction title is required"],
    },
    Charges: {
      type: Number,
      required: [true, "Charges is required"], //what you credit admin
      default: 0,
    },
    TransactionId: {
      type: String, //this id is needed for ones you create transaction like withdrawal
    },
    AdminTransactionId: {
      type: String, //this id is needed for ones you create transaction like withdrawal
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("FailedTransactions", FailedTransactions);
