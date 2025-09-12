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
const router = express.Router();

// Create Product
router.post("/add", VerifyProductOwnerJWTToken, async (req, res) => {
  try {
    const { name, description, currency, affiliateCommission, maxClicks } =
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
    if (!name || !description || !affiliateCommission || !maxClicks) {
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
        Error: "Insufficient balance",
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
      currency: currency,
      affiliateCommission: parseFloat(affiliateCommission),
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
    res.json({
      Access: true,
      product,
      affiliateLinks: await AffiliateLinkModel.find({ product: productId })
        .populate("affiliateMarketer", "FullName Email")
        .select("uniqueLinkId clickCount totalEarnings isActive createdAt"),
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

module.exports = router;
