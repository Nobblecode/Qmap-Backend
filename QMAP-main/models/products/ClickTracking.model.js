const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const ClickTracking = new Schema(
  {
    affiliateLink: {
      type: Mongoose.Schema.Types.ObjectId,
      ref: "AffiliateLink",
      required: [true, "Affliate link is required"],
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    commissionPaid: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Mongoose.model("ClickTracking", ClickTracking);
