const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const AffiliateLink = new Schema(
  {
    product: {
      type: Mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    affiliateMarketer: {
      type: Mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: [true, "Affiliate marketer is required"],
    },
    uniqueLinkId: {
      type: String,
      unique: true,
      required: [true, "Unique Link is required"],
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Mongoose.model("AffiliateLink", AffiliateLink);
