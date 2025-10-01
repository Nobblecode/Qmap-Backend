const express = require("express");
const { VerifyAffilliateMarketerJWTToken, Errordisplay } = require("../../../utils/Auth.utils");
const AffiliateLinkModel = require("../../../models/products/AffiliateLink.model");
const ProductModel = require("../../../models/products/Product.model");
const router = express.Router();

// Get performance stats for authenticated affiliate across products
router.get("/my/stats", VerifyAffilliateMarketerJWTToken, async (req, res) => {
  try {
    // Only include links that have at least one click
    const links = await AffiliateLinkModel.find({ affiliateMarketer: req.user._id, clickCount: { $gt: 0 } }).populate('product');

    const stats = links.map(link => ({
      productId: link.product?._id || null,
      productName: link.product?.name || 'Unknown',
      clicks: link.clickCount || 0,
      // conversion value: total clicks * affiliateCommission
      totalEarnings: (link.clickCount || 0) * (link.product?.affiliateCommission || 0),
      isActive: link.isActive,
      shareUrl: `${req.protocol}://${req.get('host')}/product/api/redirect/${link.uniqueLinkId}`,
    }));

    return res.json({ Access: true, stats });
  } catch (error) {
    return res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
