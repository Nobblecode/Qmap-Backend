const express = require('express');
const router = express.Router();
const AffiliateLinkModel = require('../../../models/products/AffiliateLink.model');
const ClickTrackingModel = require('../../../models/products/ClickTracking.model');
const ProductModel = require('../../../models/products/Product.model');
const BalanceModel = require('../../../models/wallet/Balance.model');
const TransactionsModel = require('../../../models/wallet/Transactions.model');
const ProfileModel = require('../../../models/user/Profile.model');
const { createNotification } = require('../../../utils/Notifications.utils');
const { Sendmail } = require('../../../utils/Mailer.utils');

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

    // Prevent duplicate clicks from same IP + userAgent within 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alreadyClicked = await ClickTrackingModel.findOne({
      affiliateLink: affiliateLink._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: { $gte: twentyFourHoursAgo }
    });
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

    // Do not rely on stored totalEarnings (compute when needed)
    await affiliateLink.save();
    await product.save();

    // Credit affiliate balance for this click
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
      // Notify product owner about deactivation
      try {
        const owner = await ProfileModel.findById(product.productOwner).lean();
        if (owner) {
          const message = `Dear ${owner.FullName}, your product \"${product.name}\" has been disabled because it reached its maximum number of clicks.`;
          // fire-and-forget notification
          createNotification(owner._id, message).catch(() => {});
          // send email to product owner
          try {
            const subject = `Your product \"${product.name}\" has been disabled`;
            const html = `<p>Dear ${owner.FullName},</p><p>Your product "<strong>${product.name}</strong>" has been disabled because it reached its maximum number of clicks (${product.maxClicks}).</p><p>Please, edit or delete the product if it's not needed anymore</p>`;
            Sendmail(owner.Email, subject, html).catch((e) => console.error('Sendmail error:', e));
          } catch (mailErr) {
            console.error('Sendmail error:', mailErr);
          }
        }
      } catch (err) {
        // swallow notification errors
        console.error('Notification error:', err.message || err);
      }
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
    // Conversion commission uses affiliateCommission; credit affiliate balance
    const commission = product.affiliateCommission || 0;
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

