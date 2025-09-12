const express = require("express");
const {
  VerifyAffilliateMarketerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const ProductModel = require("../../../models/products/Product.model");
const AffiliateLinkModel = require("../../../models/products/AffiliateLink.model");
const crypto = require("crypto");
const ClickTrackingModel = require("../../../models/products/ClickTracking.model");
const BalanceModel = require("../../../models/wallet/Balance.model");
const TransactionsModel = require("../../../models/wallet/Transactions.model");
const router = express.Router();

// Generate Affiliate Link
router.post(
  "/affiliate-links/:productId",
  VerifyAffilliateMarketerJWTToken,
  async (req, res) => {
    try {
      const { productId } = req.params;

      // Check if user is affiliate marketer
      if (req.user.type !== "Affiliate") {
        return res.status(403).json({
          Access: true,
          Error: "Only affiliate marketers can generate links",
        });
      }

      // Find product
      const product = await ProductModel.findById(productId);
      if (!product) {
        return res
          .status(404)
          .json({ Access: true, Error: "Product not found" });
      }

      // Check if product is active and hasn't reached max clicks
      if (!product.isActive || product.currentClicks >= product.maxClicks) {
        return res.status(400).json({
          Access: true,
          Error: "Product is no longer available for affiliate marketing",
        });
      }

      // Check if affiliate already has a link for this product
      let affiliateLink = await AffiliateLinkModel.findOne({
        product: productId,
        affiliateMarketer: req.user._id,
      });

      if (affiliateLink) {
        // Return existing link
        return res.json({
          Access: true,
          Message: "Affiliate link already exists",
          affiliateLink: {
            id: affiliateLink._id,
            uniqueLinkId: affiliateLink.uniqueLinkId,
            clickCount: affiliateLink.clickCount,
            totalEarnings: affiliateLink.totalEarnings,
            shareUrl: `${req.protocol}://${req.get(
              "host"
            )}/product/api/redirect/${affiliateLink.uniqueLinkId}`,
          },
        });
      }

      // Generate unique link ID
      const uniqueLinkId = crypto.randomBytes(16).toString("hex");

      // Create affiliate link
      affiliateLink = new AffiliateLinkModel({
        product: productId,
        affiliateMarketer: req.user._id,
        uniqueLinkId,
      });

      await affiliateLink.save();

      res.status(200).json({
        Access: true,
        Message: "Affiliate link created successfully",
        affiliateLink: {
          id: affiliateLink._id,
          uniqueLinkId: affiliateLink.uniqueLinkId,
          clickCount: affiliateLink.clickCount,
          totalEarnings: affiliateLink.totalEarnings,
          shareUrl: `${req.protocol}://${req.get(
            "host"
          )}/product/api/redirect/${affiliateLink.uniqueLinkId}`,
        },
      });
    } catch (error) {
      res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
    }
  }
);

// Route 3: Handle Link Clicks and Redirects
router.get("/api/redirect/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;

    // Find affiliate link
    const affiliateLink = await AffiliateLinkModel.findOne({
      uniqueLinkId: linkId,
    })
      .populate("product")
      .populate("affiliateMarketer");

    if (!affiliateLink || !affiliateLink.isActive) {
      return res
        .status(404)
        .json({ Access: true, Error: "Link not found or inactive" });
    }

    const product = affiliateLink.product;

    // Check if product is still active and hasn't reached max clicks
    if (!product.isActive || product.currentClicks >= product.maxClicks) {
      return res
        .status(400)
        .json({ Access: true, Error: "Product is no longer available" });
    }

    const alreadyClicked = await ClickTrackingModel.findOne({
      affiliateLink: affiliateLink._id,
      ipAddress: req.ip,
    });

    if (alreadyClicked) {
      return res
        .status(400)
        .json({ Access: true, Error: "You already clicked this link" });
    }

    // Track the click
    const clickTracking = new ClickTrackingModel({
      affiliateLink: affiliateLink._id,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });
    await clickTracking.save();

    // Update click counts
    affiliateLink.clickCount += 1;
    product.currentClicks += 1;

    // Calculate and add commission to affiliate's balance
    const commission = product.affiliateCommission;
    affiliateLink.totalEarnings += commission;
    // affiliateLink.affiliateMarketer.balance += commission;

    // Save updates
    await affiliateLink.save();
    await product.save();
    // await affiliateLink.affiliateMarketer.save();
    await BalanceModel.findOneAndUpdate(
      { UserID: affiliateLink.affiliateMarketer, TypeOf: "Affiliate" },
      { $inc: { Balance: commission } }
    );

    const Balance = await BalanceModel.findOne({
      UserID: affiliateLink.affiliateMarketer,
      TypeOf: "Affiliate",
    });

    // Record commission transaction
    const transaction = new TransactionsModel({
      WalletID: Balance._id,
      UserId: affiliateLink.affiliateMarketer,
      TransRef: affiliateLink._id,
      Amount: commission,
      Title: `Affiliate commission: ${product.name}`,
      Charges: 0,
      Type: "Credit",
      Process: "Success",
      TypeOf: "Affiliate",
    });
    await transaction.save();

    // Mark commission as paid
    clickTracking.commissionPaid = true;
    await clickTracking.save();

    // Check if max clicks reached and deactivate product
    if (product.currentClicks >= product.maxClicks) {
      product.isActive = false;
      await product.save();

      // Deactivate all affiliate links for this product
      await AffiliateLinkModel.updateMany(
        { product: product._id },
        { isActive: false }
      );
    }

    // Redirect to the actual product page or landing page
    // Replace with your actual product URL
    res.redirect(
      `https://qmap.com.ng/product-owner-dashboard/${product.uniqueProductId}`
    );
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

//Get User's Affiliate Links
router.get(
  "/my-affiliate-links",
  VerifyAffilliateMarketerJWTToken,
  async (req, res) => {
    try {
      if (req.user.type !== "Affiliate") {
        return res.status(403).json({
          Access: true,
          Error: "Only affiliate marketers can view their links",
        });
      }

      const affiliateLinks = await AffiliateLinkModel.find({
        affiliateMarketer: req.user._id,
      })
        .populate(
          "product",
          "name description currency affiliateCommission isActive"
        )
        .sort({ createdAt: -1 });

      const linksWithUrls = affiliateLinks.map((link) => ({
        ...link.toObject(),
        shareUrl: `${req.protocol}://${req.get("host")}/product/api/redirect/${
          link.uniqueLinkId
        }`,
      }));

      res.json({ Access: true, affiliateLinks: linksWithUrls });
    } catch (error) {
      res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
    }
  }
);

module.exports = router;
