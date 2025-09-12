const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const TemporaryDeposit = new Schema(
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
      min: [100, "Amount is too small"],
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

module.exports = Mongoose.model("TemporaryDeposit", TemporaryDeposit);
