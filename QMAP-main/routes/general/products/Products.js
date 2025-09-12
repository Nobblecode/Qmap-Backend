const express = require("express");
const ProductModel = require("../../../models/products/Product.model");
const { Errordisplay } = require("../../../utils/Auth.utils");
const router = express.Router();

router.get("/all", async (req, res) => {
  try {
    const products = await ProductModel.find({}).sort({
      createdAt: -1,
    });

    res.json({ Access: true, products });
  } catch (error) {
    res.status(500).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
