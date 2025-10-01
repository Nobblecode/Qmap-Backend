const express = require("express");
const {
  VerifyProductOwnerJWTToken,
  Errordisplay,
} = require("../../../utils/Auth.utils");
const BalanceModel = require("../../../models/wallet/Balance.model");
const { uploadimg } = require("../../../utils/Cloudinary.utils");
const { v4: uuidv4 } = require("uuid");
const ProductModel = require("../../../models/products/Product.model");
const AffiliateLinkModel = require("../../../models/products/AffiliateLink.model");
const ClickTrackingModel = require("../../../models/products/ClickTracking.model");
const router = express.Router();

// Create Product
router.post("/add", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { name, description, currency, affiliateCommission, affiliateLink, maxClicks } =
      req.body;

    const image = req.files?.image;

    // Check if user is product owner
    if (req.user.type !== "Product Owner") {
      return res.status(403).json({
        Access: true,
        Error: "Only product owners can create products",
      });
    }

    // Validate required fields
    if (!name || !description || !affiliateCommission || !affiliateLink || !maxClicks) {
      return res
        .status(400)
        .json({ Access: true, Error: "All fields are required" });
    }

    // Calculate expected cost
    const expectedCost = parseFloat(affiliateCommission) * parseInt(maxClicks);

    const userBalance = await BalanceModel.findOne({
      UserID: req.user._id,
      TypeOf: "Product Owner",
    });

    // Check if user has sufficient balance
    if (userBalance.Balance < expectedCost) {
      return res.status(400).json({
        Access: true,
        Error: `Insufficient balance. Expected cost is ${expectedCost}`,
        requiredAmount: expectedCost,
        currentBalance: userBalance.Balance,
        deficit: expectedCost - userBalance.Balance,
      });
    }

    // Upload image to Cloudinary if provided
    let uploadedImage;
    if (image) {
      uploadedImage = await uploadimg(image, process.env.Images);

      if (uploadedImage.error) {
        return res
          .status(500)
          .json({ Access: true, Error: "Error Occured uploading image" });
      }
    }

    // Generate unique product ID
    const uniqueProductId = uuidv4();

    // Create product
    const product = new ProductModel({
      name,
      description,
      imageUrl: uploadedImage.url,
      imagePublicId: uploadedImage.publicID,
      currency,
      affiliateCommission: parseFloat(affiliateCommission),
      affiliateLink,
      maxClicks: parseInt(maxClicks),
      expectedCost,
      productOwner: req.user._id,
      uniqueProductId,
    });

    await product.save();

    await BalanceModel.findOneAndUpdate(
      {
        UserID: req.user._id,
        TypeOf: "Product Owner",
      },
      { $inc: { Balance: -expectedCost, Reserved: expectedCost } }
    );

    res.status(200).json({
      Access: true,
      Message: "Product created successfully",
      Data: {
        id: product._id,
        name: product.name,
        description: product.description,
        image: product.image,
        currency: product.currency,
        affiliateCommission: product.affiliateCommission,
        maxClicks: product.maxClicks,
        expectedCost: product.expectedCost,
        uniqueProductId: product.uniqueProductId,
        isActive: product.isActive,
      },
      Error: false,
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// Get Product Details
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await ProductModel.findById(productId).populate(
      "productOwner",
      "FullName Email"
    );

    if (!product) {
      return res.status(404).json({ Access: true, Error: "Product not found" });
    }

    // Check if user is the product owner or return limited info
    const rawLinks = await AffiliateLinkModel.find({ product: productId })
      .populate("affiliateMarketer", "FullName Email")
      .select("uniqueLinkId clickCount totalEarnings isActive createdAt");

    const affiliateLinks = rawLinks.map((l) => {
      const computedEarnings = (l.clickCount || 0) * (product.affiliateCommission || 0);
      return {
        _id: l._id,
        uniqueLinkId: l.uniqueLinkId,
        clickCount: l.clickCount,
        totalEarnings: computedEarnings,
        isActive: l.isActive,
        createdAt: l.createdAt,
        affiliateMarketer: l.affiliateMarketer,
      };
    });

    res.json({
      Access: true,
      product,
      affiliateLinks,
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// Get User's Products
router.get("/my/products", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    if (req.user.type !== "Product Owner") {
      return res.status(403).json({
        Access: true,
        Error: "Only product owners can view their products",
      });
    }

    const products = await ProductModel.find({
      productOwner: req.user._id,
    }).sort({
      createdAt: -1,
    });

    res.json({ Access: true, products });
  } catch (error) {
    res.status(500).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// Delete a product
router.delete('/:productId', VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await ProductModel.findById(productId);
    if (!product) return res.status(404).json({ Access: true, Error: 'Product not found' });

    // only owner can delete
    if (!product.productOwner.equals(req.user._id)) {
      return res.status(403).json({ Access: true, Error: 'Not authorized to delete this product' });
    }

    // Find affiliate links for this product
    const links = await AffiliateLinkModel.find({ product: product._id }).select('_id');
    const linkIds = links.map((l) => l._id);

    // Remove click tracking for these links
    if (linkIds.length > 0) {
      await ClickTrackingModel.deleteMany({ affiliateLink: { $in: linkIds } });
    }

    // Remove affiliate links
    await AffiliateLinkModel.deleteMany({ product: product._id });

    // Delete the product
    await ProductModel.findByIdAndDelete(productId);

    // Refund reserved funds back to owner's balance (if any)
    try {
      await BalanceModel.findOneAndUpdate(
        { UserID: req.user._id, TypeOf: 'Product Owner' },
        { $inc: { Balance: product.expectedCost || 0, Reserved: -(product.expectedCost || 0) } }
      );
    } catch (refundErr) {
      console.error('Refund after product delete failed', refundErr);
    }

    return res.json({ Access: true, Message: 'Product deleted' });
  } catch (error) {
    return res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

// Update Product
router.put('/:productId', VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // find product
    const product = await ProductModel.findById(productId);
    if (!product) return res.status(404).json({ Access: true, Error: 'Product not found' });

    // only owner can update
    if (!product.productOwner.equals(req.user._id)) {
      return res.status(403).json({ Access: true, Error: 'Not authorized to edit this product' });
    }

    const image = req.files?.image;
    let uploadedImage;
    if (image) {
      uploadedImage = await uploadimg(image, process.env.Images);
      if (uploadedImage.error) {
        return res.status(500).json({ Access: true, Error: 'Error Occured uploading image' });
      }
      product.imageUrl = uploadedImage.url;
      product.imagePublicId = uploadedImage.publicID;
    }

    // Allowed fields to update
    const { name, description, currency, affiliateCommission, affiliateLink, maxClicks, isActive } = req.body;

    // Compute new expected cost if commission/maxClicks provided
    const newAffiliateCommission = typeof affiliateCommission !== 'undefined' ? parseFloat(affiliateCommission) : product.affiliateCommission;
    const newMaxClicks = typeof maxClicks !== 'undefined' ? parseInt(maxClicks, 10) : product.maxClicks;
    const newExpectedCost = newAffiliateCommission * newMaxClicks;

    // If expected cost changed, adjust owner's balance/reserved accordingly
    if (newExpectedCost !== product.expectedCost) {
      const diff = newExpectedCost - product.expectedCost; // positive means more reserved required
      const ownerBalance = await BalanceModel.findOne({ UserID: req.user._id, TypeOf: 'Product Owner' });
      if (!ownerBalance) return res.status(400).json({ Access: true, Error: 'Owner balance not found' });

      if (diff > 0) {
        // need to reserve additional funds
        if (ownerBalance.Balance < diff) {
          return res.status(400).json({ Access: true, Error: `Insufficient balance to increase expected cost by ${diff}` });
        }
        await BalanceModel.findOneAndUpdate({ UserID: req.user._id, TypeOf: 'Product Owner' }, { $inc: { Balance: -diff, Reserved: diff } });
      } else if (diff < 0) {
        // release reserved funds
        await BalanceModel.findOneAndUpdate({ UserID: req.user._id, TypeOf: 'Product Owner' }, { $inc: { Balance: -diff, Reserved: diff } });
        // Note: diff is negative so -diff adds to Balance, Reserved decreases
      }

      product.expectedCost = newExpectedCost;
      product.affiliateCommission = newAffiliateCommission;
      product.maxClicks = newMaxClicks;
    }

    if (typeof name !== 'undefined') product.name = name;
    if (typeof description !== 'undefined') product.description = description;
    if (typeof currency !== 'undefined') product.currency = currency;
    if (typeof affiliateLink !== 'undefined') product.affiliateLink = affiliateLink;
    if (typeof isActive !== 'undefined') product.isActive = Boolean(isActive);

    await product.save();

    return res.json({
      Access: true,
      Message: 'Product updated',
      product,
    });
  } catch (error) {
    return res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;

