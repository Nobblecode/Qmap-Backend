const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const Otp = new Schema(
  {
    UserID: {
      type: String,
      required: [true, "UserId is required"],
      unique: true,
    },
    OTP: {
      type: String,
      required: [true, "OTP is required"],
    },
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 610,
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("Otp", Otp);
