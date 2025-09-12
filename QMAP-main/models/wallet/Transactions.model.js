const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const Transactions = new Schema(
  {
    WalletID: {
      type: String,
      required: [true, "your WalletID is requred "],
    },
    UserId: {
      type: String,
      required: [true, "your UserId is requred "],
    },
    TransRef: {
      type: String,
    },
    Amount: {
      type: Number,
      required: [true, "amount is required"],
      default: 0,
      min: [0, "Amount is too small"],
    },
    Title: {
      type: String,
      required: [true, "Transaction title is required"],
    },
    Charges: {
      type: Number,
      required: [true, "Charges is required"],
      default: 0,
    },
    Type: {
      type: String,
      required: [true, "Method is required"],
      enum: ["Credit", "Debit", "Admin"],
    },
    Process: {
      type: String,
      required: [true, "Process is required"],
      enum: ["Success", "Pending", "Failed"],
    },
    TypeOf: {
      type: String,
      enum: ["Product Owner", "Affiliate"],
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("Transactions", Transactions);
