// backend/src/routes/homeRoutes.js
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Gợi ý: Product có fields: createdAt, sold, category, brand, price, images, variants...
router.get("/", async (req, res) => {
  try {
    const newProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(8);

    const bestSellers = await Product.find()
      .sort({ sold: -1 })
      .limit(8);

    const laptops = await Product.find({ category: "laptop" }).limit(8);
    const monitors = await Product.find({ category: "monitor" }).limit(8);
    const hardDrives = await Product.find({ category: "hard-drive" }).limit(8);

    res.json({
      newProducts,
      bestSellers,
      categories: {
        laptops,
        monitors,
        hardDrives,
      },
    });
  } catch (error) {
    console.error("Home data error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
