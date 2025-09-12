const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const Balance = new Schema(
  {
    UserID: {
      type: String,
      required: true,
      unique: true,
    },
    Balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Balance is too small"],
    },
    TypeOf: {
      type: String,
      required: [true, "type auth is required"],
      enum: ["Product Owner", "Affiliate"],
    },
    Earned: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Balance is too small"],
    },
    Reserved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Reserved Balance is too small"],
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("Balance", Balance);
