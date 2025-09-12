const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const AdminTransactions = new Schema(
  {
    UserId: {
      type: String,
      required: [true, "your UserId is requred "],
    },
    Amount: {
      type: Number,
      required: [true, "amount is required"],
      default: 0,
      min: [0, "Amount is too small"],
    },
    Description: {
      type: String,
      required: [true, "Transaction Description is required"],
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
    ref: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("AdminTransactions", AdminTransactions);
