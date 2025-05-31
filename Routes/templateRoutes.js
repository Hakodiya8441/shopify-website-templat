const express = require("express");
const router = express.Router();
const PitchedPricing = require("../Models/template"); // adjust path as needed

router.post("/add-template", async (req, res) => {
  try {
    const {
      pitchedPayload
    } = req.body;

    if (!pitchedPayload) {
      return res.status(400).json({ message: "Missing pitchedPayload" });
    }

    const {
      date,
      time,
      shop_Name,
      buyer_Name,
      shop_Number,
      Market,
      contact_Details,
      payment_Terms,
      commoditySkuDetails,
      transport_Expenses,
      unloading_Charges,
      unloading
    } = pitchedPayload;

    // Validate required fields
    if (!shop_Name || !commoditySkuDetails || !Array.isArray(commoditySkuDetails) || commoditySkuDetails.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }


    const newPricing = new PitchedPricing({
      date,
      time,
      shop_Name,
      buyer_Name,
      shop_Number,
      Market,
      contact_Details,
      payment_Terms,
      commoditySkuDetails,
      transport_Expenses,
      unloading_Charges,
      unloading
    });

    const savedPricing = await newPricing.save();
    res.status(201).json({
      message: "Pitched pricing saved successfully",
      data: savedPricing,
    });

  } catch (error) {
    console.error("Error saving pitched pricing:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;