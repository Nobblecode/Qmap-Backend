const Mongoose = require("mongoose");

const Schema = Mongoose.Schema;

const AdminBalance = new Schema(
  {
    EarnedBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    TotalClientFunds: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("AdminBalance", AdminBalance);
