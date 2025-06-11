const express = require("express");
const router = express.Router();
const PitchedPricing = require("../models/PitchedPricing");

// PATCH /api/pitched-pricing/:id
router.patch("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { commodity_name, sku_name, quantity, type_of_packing } = req.body;

  if (!commodity_name || !sku_name) {
    return res.status(400).json({ message: "commodity_name and sku_name are required" });
  }

  try {
    const updated = await PitchedPricing.findOneAndUpdate(
      {
        _id: id,
        "commoditySkuDetails.commodity_name": commodity_name,
        "commoditySkuDetails.sku_name": sku_name,
      },
      {
        $set: {
          "commoditySkuDetails.$.quantity": quantity,
          "commoditySkuDetails.$.type_of_packing": type_of_packing,
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Document or SKU not found" });
    }

    res.status(200).json({ message: "Updated successfully", data: updated });
  } catch (error) {
    console.error("Update failed:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
