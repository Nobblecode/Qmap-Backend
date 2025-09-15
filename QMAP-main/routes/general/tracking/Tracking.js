const express = require('express');
const router = express.Router();
const AffiliateLinkModel = require('../../../models/products/AffiliateLink.model');
const ClickTrackingModel = require('../../../models/products/ClickTracking.model');
const ProductModel = require('../../../models/products/Product.model');
const BalanceModel = require('../../../models/wallet/Balance.model');
const TransactionsModel = require('../../../models/wallet/Transactions.model');

// Record a click (client-side ping)
router.post('/click/:uniqueLinkId', async (req, res) => {
  try {
    const { uniqueLinkId } = req.params;

    const affiliateLink = await AffiliateLinkModel.findOne({ uniqueLinkId }).populate('product');
    if (!affiliateLink) return res.status(404).json({ Access: true, Error: 'Affiliate link not found' });

    const product = affiliateLink.product;
    if (!product || !product.isActive || product.currentClicks >= product.maxClicks) {
      return res.status(400).json({ Access: true, Error: 'Product not available' });
    }

    // Prevent duplicate clicks from same IP
    const alreadyClicked = await ClickTrackingModel.findOne({ affiliateLink: affiliateLink._id, ipAddress: req.ip });
    if (alreadyClicked) return res.status(400).json({ Access: true, Error: 'You already clicked this link' });

    const click = new ClickTrackingModel({
      affiliateLink: affiliateLink._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
    await click.save();

    // Update counts and commission
    affiliateLink.clickCount += 1;
    product.currentClicks += 1;
    const commission = product.affiliateCommission || 0;
    affiliateLink.totalEarnings += commission;

    await affiliateLink.save();
    await product.save();

    // Credit affiliate balance
    await BalanceModel.findOneAndUpdate(
      { UserID: affiliateLink.affiliateMarketer, TypeOf: 'Affiliate' },
      { $inc: { Balance: commission } },
      { upsert: true }
    );

    const Balance = await BalanceModel.findOne({ UserID: affiliateLink.affiliateMarketer, TypeOf: 'Affiliate' });
    const transaction = new TransactionsModel({
      WalletID: Balance ? Balance._id : null,
      UserId: affiliateLink.affiliateMarketer,
      TransRef: affiliateLink._id,
      Amount: commission,
      Title: `Affiliate commission: ${product ? product.name : 'product'}`,
      Charges: 0,
      Type: 'Credit',
      Process: 'Success',
      TypeOf: 'Affiliate',
    });
    await transaction.save();

    // Mark commission as paid for the click
    click.commissionPaid = true;
    await click.save();

    // Deactivate if max clicks reached
    if (product.currentClicks >= product.maxClicks) {
      product.isActive = false;
      await product.save();
      await AffiliateLinkModel.updateMany({ product: product._id }, { isActive: false });
    }

    res.json({ Access: true, Message: 'Click recorded' });
  } catch (error) {
    res.status(400).json({ Access: true, Error: error.message });
  }
});

// Record a conversion (client-side ping)
router.post('/conversion/:uniqueLinkId', async (req, res) => {
  try {
    const { uniqueLinkId } = req.params;

    const affiliateLink = await AffiliateLinkModel.findOne({ uniqueLinkId }).populate('product');
    if (!affiliateLink) return res.status(404).json({ Access: true, Error: 'Affiliate link not found' });

    const product = affiliateLink.product;

    // Record a conversion on click tracking (create a record flagged as conversion)
    const click = new ClickTrackingModel({
      affiliateLink: affiliateLink._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      conversion: true,
      commissionPaid: false,
    });
    await click.save();

    // Compute conversion commission (could be same as affiliateCommission)
    const commission = product.affiliateCommission || 0;

    // Credit affiliate balance for conversion
    await BalanceModel.findOneAndUpdate(
      { UserID: affiliateLink.affiliateMarketer, TypeOf: 'Affiliate' },
      { $inc: { Balance: commission } },
      { upsert: true }
    );

    const Balance = await BalanceModel.findOne({ UserID: affiliateLink.affiliateMarketer, TypeOf: 'Affiliate' });
    const transaction = new TransactionsModel({
      WalletID: Balance ? Balance._id : null,
      UserId: affiliateLink.affiliateMarketer,
      TransRef: affiliateLink._id,
      Amount: commission,
      Title: `Affiliate conversion commission: ${product ? product.name : 'product'}`,
      Charges: 0,
      Type: 'Credit',
      Process: 'Success',
      TypeOf: 'Affiliate',
    });
    await transaction.save();

    // Mark commission paid on the conversion record
    click.commissionPaid = true;
    await click.save();

    res.json({ Access: true, Message: 'Conversion recorded' });
  } catch (error) {
    res.status(400).json({ Access: true, Error: error.message });
  }
});

// Get click counts by affiliate email and product id
router.get('/counts/clicks/:affiliateEmail/:productId', async (req, res) => {
  try {
    const { affiliateEmail, productId } = req.params;
    const ProfileModel = require('../../../models/user/Profile.model');
    const profile = await ProfileModel.findOne({ Email: affiliateEmail });
    if (!profile) return res.json({ Access: true, count: 0 });

    const links = await AffiliateLinkModel.find({ affiliateMarketer: profile._id, product: productId });
    if (links && links.length > 0) {
      const linkIds = links.map((l) => l._id);
      const count = await ClickTrackingModel.countDocuments({ affiliateLink: { $in: linkIds }, conversion: { $ne: true } });
      return res.json({ Access: true, count });
    }
    return res.json({ Access: true, count: 0 });
  } catch (error) {
    res.status(400).json({ Access: true, Error: error.message });
  }
});

// Get conversion counts by affiliate email and product id
router.get('/counts/conversions/:affiliateEmail/:productId', async (req, res) => {
  try {
    const { affiliateEmail, productId } = req.params;
    const ProfileModel = require('../../../models/user/Profile.model');
    const profile = await ProfileModel.findOne({ Email: affiliateEmail });
    if (!profile) return res.json({ Access: true, count: 0 });

    const links = await AffiliateLinkModel.find({ affiliateMarketer: profile._id, product: productId });
    if (links && links.length > 0) {
      const linkIds = links.map((l) => l._id);
      const count = await ClickTrackingModel.countDocuments({ affiliateLink: { $in: linkIds }, conversion: true });
      return res.json({ Access: true, count });
    }
    return res.json({ Access: true, count: 0 });
  } catch (error) {
    res.status(400).json({ Access: true, Error: error.message });
  }
});

module.exports = router;

