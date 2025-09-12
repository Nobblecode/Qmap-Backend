const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TemporaryWithdrawal = new Schema(
  {
    UserId: {
      type: String,
      required: [true, "your UserId is requred "],
      unique: true,
    },
    Amount: {
      type: Number,
      required: [true, "amount is required"],
      default: 0,
    },
    Bank: {
      type: String,
      required: [true, "bank code is required"],
    },
    AccountNumber: {
      type: String,
      required: [true, "account number is required"],
    },
    AccountName: {
      type: String,
      required: [true, "account name is required"],
    },
    TypeOf: {
      type: String,
      required: [true, "type auth is required"],
      enum: ["Product Owner", "Affiliate", "Admin"],
    },
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 10800,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TemporaryWithdrawal", TemporaryWithdrawal);
