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

    // optional image upload
    const image = req.files?.image;
    if (image) {
      const uploadedImage = await uploadimg(image, process.env.Images);
      if (uploadedImage.error) {
        return res.status(500).json({ Access: true, Error: 'Error Occured uploading image' });
      }
      product.imageUrl = uploadedImage.url;
      product.imagePublicId = uploadedImage.publicID;
    }

    // Allowed fields to update
    const { name, description, currency, affiliateCommission, affiliateLink, maxClicks } = req.body;

    // Determine if maxClicks was provided (and not empty string)
    const hasMaxClicksUpdate = typeof maxClicks !== 'undefined' && String(maxClicks).trim() !== '';

    // Safe parse affiliateCommission
    const hasAffiliateCommissionUpdate =
      typeof affiliateCommission !== 'undefined' && String(affiliateCommission).trim() !== '';
    const parsedAffiliateCommission = hasAffiliateCommissionUpdate
      ? parseFloat(affiliateCommission)
      : product.affiliateCommission;

    if (hasAffiliateCommissionUpdate && (isNaN(parsedAffiliateCommission) || parsedAffiliateCommission < 0)) {
      return res.status(400).json({ Access: true, Error: 'Invalid affiliateCommission value' });
    }

    // Safe parse maxClicks
    const parsedMaxClicks = hasMaxClicksUpdate ? parseInt(maxClicks, 10) : product.maxClicks;
    if (hasMaxClicksUpdate && (isNaN(parsedMaxClicks) || parsedMaxClicks < 1)) {
      return res.status(400).json({ Access: true, Error: 'Invalid maxClicks value' });
    }

    const newAffiliateCommission = parsedAffiliateCommission;
    const newMaxClicks = parsedMaxClicks;

    // Compute new expected cost
    const newExpectedCost = (typeof newAffiliateCommission === 'number' && !isNaN(newAffiliateCommission) ? newAffiliateCommission : 0) * (typeof newMaxClicks === 'number' && !isNaN(newMaxClicks) ? newMaxClicks : 0);

    // If expected cost changed, adjust owner's balance/reserved accordingly
    if (typeof product.expectedCost === 'number' && newExpectedCost !== product.expectedCost) {
      const diff = newExpectedCost - product.expectedCost; // positive => need to reserve more
      const ownerBalance = await BalanceModel.findOne({ UserID: req.user._id, TypeOf: 'Product Owner' });
      if (!ownerBalance) return res.status(400).json({ Access: true, Error: 'Owner balance not found' });

      if (diff > 0) {
        // need to reserve additional funds
        if (ownerBalance.Balance < diff) {
          return res.status(400).json({ Access: true, Error: `Insufficient balance to increase expected cost by ${diff}` });
        }
        await BalanceModel.findOneAndUpdate(
          { UserID: req.user._id, TypeOf: 'Product Owner' },
          { $inc: { Balance: -diff, Reserved: diff } }
        );
      } else if (diff < 0) {
        // release reserved funds (diff negative)
        // -diff will be positive and added to Balance, Reserved decreases by |diff|
        await BalanceModel.findOneAndUpdate(
          { UserID: req.user._id, TypeOf: 'Product Owner' },
          { $inc: { Balance: -diff, Reserved: diff } }
        );
      }

      product.expectedCost = newExpectedCost;
      product.affiliateCommission = newAffiliateCommission;
      product.maxClicks = newMaxClicks;
    } else {
      // Even if expectedCost didn't change, we still apply maxClicks/affiliateCommission updates if provided
      if (hasMaxClicksUpdate && newMaxClicks !== product.maxClicks) {
        product.maxClicks = newMaxClicks;
      }
      if (hasAffiliateCommissionUpdate && newAffiliateCommission !== product.affiliateCommission) {
        product.affiliateCommission = newAffiliateCommission;
      }
    }

    // If maxClicks was updated in this request, update product.isActive accordingly:
    // product is active iff maxClicks > currentClicks
    if (hasMaxClicksUpdate) {
      const currentClicks = product.currentClicks || 0;
      product.isActive = newMaxClicks > currentClicks;
    }

    // Other simple field updates
    if (typeof name !== 'undefined') product.name = name;
    if (typeof description !== 'undefined') product.description = description;
    if (typeof currency !== 'undefined') product.currency = currency;
    if (typeof affiliateLink !== 'undefined') product.affiliateLink = affiliateLink;

    await product.save();

    // Update affiliate links isActive based on each link's clickCount relative to product.maxClicks
    let affiliateLinksUpdateResult = null;
    try {
      // enable those with room under maxClicks
      const enableRes = await AffiliateLinkModel.updateMany(
        { product: product._id, clickCount: { $lt: product.maxClicks } },
        { $set: { isActive: true } }
      );

      // disable those that have reached/exceeded maxClicks
      const disableRes = await AffiliateLinkModel.updateMany(
        { product: product._id, clickCount: { $gte: product.maxClicks } },
        { $set: { isActive: false } }
      );

      affiliateLinksUpdateResult = {
        enabledMatched: enableRes.matchedCount ?? enableRes.n ?? 0,
        enabledModified: enableRes.modifiedCount ?? enableRes.nModified ?? 0,
        disabledMatched: disableRes.matchedCount ?? disableRes.n ?? 0,
        disabledModified: disableRes.modifiedCount ?? disableRes.nModified ?? 0,
      };
    } catch (affErr) {
      console.error('Failed to update affiliate link isActive flags for product', product._id, affErr);
      // keep affiliateLinksUpdateResult null to indicate warning
    }

    const responsePayload = {
      Access: true,
      Message: 'Product updated',
      product,
      affiliateLinksUpdated: affiliateLinksUpdateResult,
    };

    if (!affiliateLinksUpdateResult) {
      // include a non-fatal warning if affiliate update failed
      responsePayload.Warning = 'Product updated but failed to update affiliate links isActive flags. Check server logs.';
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error('Product update error', error);
    return res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;

