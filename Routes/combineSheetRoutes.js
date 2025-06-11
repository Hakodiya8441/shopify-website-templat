const express = require("express");
const axios = require("axios");
const CommoditySkuPricing = require("../Models/comodityPrice");
const moment = require("moment-timezone");
const router = express.Router();
const CombineSheet = require("../Models/combinesheet");

function calculateInterestCredit(days) {
  let rate = 0;
  if (days >= 0 && days <= 5) rate = 0.25;
  else if (days >= 6 && days <= 10) rate = 0.50;
  else if (days >= 11 && days <= 15) rate = 1;
  else if (days >= 16 && days <= 20) rate = 1.5;
  else rate = 2;
  return days * rate;
}

router.get("/combine", async (req, res) => {
  try {
    let { commodity_name, sku_name, contact, quantity, typeOfPacking } = req.query;

    if (!contact || !quantity || !typeOfPacking || !commodity_name || !sku_name) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const commodities = Array.isArray(commodity_name) ? commodity_name : commodity_name.split(",");
    const skus = Array.isArray(sku_name) ? sku_name : sku_name.split(",");
    const quantities = Array.isArray(quantity) ? quantity : quantity.split(",");
    const packings = Array.isArray(typeOfPacking) ? typeOfPacking : typeOfPacking.split(",");
    const contacts = Array.isArray(contact) ? contact : contact.split(",");
    const contactNumbers = contacts.map(num => Number(num));

    if (
      commodities.length !== skus.length ||
      commodities.length !== quantities.length ||
      commodities.length !== packings.length
    ) {
      return res.status(400).json({ message: "All parameter arrays must be of the same length" });
    }

    let combineData = await CombineSheet.find({
      Commodity: { $in: commodities },
      SKU: { $in: skus },
      Contact_Details: { $in: contactNumbers },
      Bag_Packet_Size: { $in: packings },
    });

    if (!combineData.length) {
      console.warn("No full CombineSheet match. Fallback to contact-only.");
      combineData = await CombineSheet.find({ Contact_Details: { $in: contactNumbers } });
      if (!combineData.length) {
        return res.status(404).json({ message: "No CombineSheet data found" });
      }
    }

    const orders = combineData.map(entry => ({
      Commodity: entry.Commodity,
      SKU: entry.SKU,
      Kg: entry.Kg,
      Price: entry.Price,
      Shop_Name: entry.Shop_Name || "",
      Buyer_Name: entry.Buyer_Name || "",
      Shop_Number: entry.Shop_Number || "empty",
      Market: entry.Market || "",
      Transport_Expenses: entry.Transport_Expenses || "",
      Unloading_Charges: entry.Unloading_Charges || "",
      Unloading: entry.unloading || "Cash",
    }));

    const totalOrders = orders.length;
    const totalTransactionPrice = orders.reduce((sum, order) => sum + (parseFloat(order.Price) || 0), 0);
    const totalVolume = orders.reduce((sum, order) => sum + (parseFloat(order.Kg) || 0), 0);
    const AOV = totalTransactionPrice / totalOrders;

    const commoditySkuDetails = [];

    for (let i = 0; i < commodities.length; i++) {
      const commodity = commodities[i].trim();
      const sku = skus[i].trim();
      const qty = quantities[i].trim();
      const packing = packings[i].trim();

      const filteredOrders = orders.filter(order =>
        order.Commodity?.toLowerCase() === commodity.toLowerCase() &&
        order.SKU?.toLowerCase() === sku.toLowerCase()
      );

      const orderToUse = filteredOrders[0] || orders[0];
      if (!orderToUse) continue;

      const pricingData = await CommoditySkuPricing.findOne({
        commodity_name: new RegExp(`^${commodity}$`, "i"),
        sku_name: new RegExp(`^${sku}$`, "i"),
        typeOfPacking: new RegExp(`^${packing}$`, "i"),
      });

      if (!pricingData) continue;

      const maxPrice = pricingData.max_bag_price;
      const minPrice = pricingData.min_bag_price;
      const totalInterest = calculateInterestCredit(2);
      const volumeDiscount = (maxPrice - minPrice) / (parseFloat(orderToUse.Kg) || 1);
      const fx = maxPrice + totalInterest - volumeDiscount;

      commoditySkuDetails.push({
        commodity_name: commodity,
        sku_name: sku,
        quantity: qty,
        type_of_packing: packing,
        fx: `${Math.round(fx)} Rs`,
      });
    }

    // Deduplicate
    const uniqueMap = new Map();
    for (const item of commoditySkuDetails) {
      const key = `${item.commodity_name.toLowerCase()}-${item.sku_name.toLowerCase()}-${item.type_of_packing.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const uniqueCommoditySkuDetails = Array.from(uniqueMap.values());

    const orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const orderTime = moment().tz("Asia/Kolkata").format("HH:mm:ss");

    const payload = {
      date: orderDate,
      time: orderTime,
      shop_Name: orders[0]?.Shop_Name || "",
      buyer_Name: orders[0]?.Buyer_Name || "",
      shop_Number: orders[0]?.Shop_Number || "empty",
      Market: orders[0]?.Market || "",
      contact_Details: contactNumbers,
      commoditySkuDetails: uniqueCommoditySkuDetails,
      transport_Expenses: orders[0]?.Transport_Expenses || "",
      unloading_Charges: orders[0]?.Unloading_Charges || "",
      unloading: orders[0]?.Unloading || "Cash",
      payment_Terms: "Cash",
    };

    // 🟢 POST to /api/add-template using axios
    try {
      const postRes = await axios.post("https://shopify-website-template.onrender.com/api/add-template", {
        pitchedPayload: payload,
      });

      console.log("✅ Data posted to /api/add-template");
      res.status(200).json({
        message: "Pricing generated and posted successfully",
        postedData: postRes.data,
      });
    } catch (postErr) {
      console.error("❌ Error posting to /api/add-template:", postErr.message);
      res.status(500).json({
        message: "Pricing generated but failed to post",
        payload,
        error: postErr.message,
      });
    }
  } catch (err) {
    console.error("Error in /combine route:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
