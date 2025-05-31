const express = require("express");
const router = express.Router();
const CommodityPricingSku = require("../Models/comodityPrice");

// POST /api/sku-pricing - Create a new SKU pricing entry
router.post("/pricing", async (req, res) => {
  try {
    const sku = await CommodityPricingSku.create(req.body);
    res.status(201).json(sku);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/sku-pricing - Get all SKU pricing entries
router.get("/pricing", async (req, res) => {
  try {
    const skus = await CommodityPricingSku.find();
    res.status(200).json(skus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// PATCH /:sku_code - Update SKU pricing by sku_code
router.patch("/:sku_code", async (req, res) => {
    try {
      const { sku_code } = req.params;
  
      const updatedSku = await CommodityPricingSku.findOneAndUpdate(
        { sku_code },
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );
  
      if (!updatedSku) {
        return res.status(404).json({ error: "SKU with this code not found" });
      }
  
      res.status(200).json(updatedSku);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

module.exports = router;
