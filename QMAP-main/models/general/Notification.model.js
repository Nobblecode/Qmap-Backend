const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Nofication = new Schema(
  {
    User_id: {
      type: String,
      required: [true, "User id is required"],
    },
    Message: {
      type: String,
      required: [true, "Please"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", Nofication);
