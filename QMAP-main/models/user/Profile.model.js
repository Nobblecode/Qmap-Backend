const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const Profile = new Schema(
  {
    FullName: {
      type: String,
      required: [true, "Full name is required"],
    },
    Email: {
      type: String,
      required: [true, "Fill your Email"],
      unique: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Email is invalid",
      ],
    },
    Password: {
      type: String,
      required: [
        true,
        "Your password must be at least 6 characters long and include at least one lowercase letter (a-z), one uppercase letter (A-Z), one number (0-9), and one special character from the set (@, $, !, %, *, ?, &).",
      ],
    },
    emailVerify: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      required: [true, "Select user type"],
      enum: ["Product Owner", "Affiliate"],
    },
  },
  { timestamps: true }
);

module.exports = Mongoose.model("Profile", Profile);
