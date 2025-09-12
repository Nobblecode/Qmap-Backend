const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const Product = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    imageUrl: {
      type: String,
    },
    imagePublicId: {
      type: String,
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      default: "NGN",
      enum: ["USD", "EUR", "GBP", "INR", "JPY", "KRW", "NGN"],
    },
    affiliateCommission: {
      type: Number,
      required: [true, "Commission is required"],
      min: 0,
    },
    maxClicks: {
      type: Number,
      required: [true, "Maximum number of clicks is required"],
      min: 1,
    },
    currentClicks: {
      type: Number,
      default: 0,
    },
    expectedCost: {
      type: Number,
      required: [true, "Expected cost is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    productOwner: {
      type: Mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: [true, "Product owner is required"],
    },
    uniqueProductId: {
      type: String,
      unique: true,
      required: [true, "Unique product id is required"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Mongoose.model("Product", Product);
