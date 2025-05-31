const express = require("express");
const CommoditySkuPricing = require("../Models/comodityPrice");
const moment = require("moment-timezone");
const router = express.Router();
const CombineSheet = require("../Models/combinesheet"); // Your CombineSheet model

// Interest credit logic
function calculateInterestCredit(days) {
  let rate = 0;
  if (days >= 0 && days <= 5) rate = 0.25;
  else if (days >= 6 && days <= 10) rate = 0.50;
  else if (days >= 11 && days <= 15) rate = 1;
  else if (days >= 16 && days <= 20) rate = 1.5;
  else rate = 2;
  return days * rate;
}

// Normalize keys & numeric conversion
function cleanOrderObject(rawObj) {
  const cleaned = {};
  for (const key in rawObj) {
    const cleanKey = key.replace(/\n/g, "").trim();
    let value = rawObj[key];
    if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) {
      value = parseFloat(value.trim());
    }
    cleaned[cleanKey] = value;
  }
  return cleaned;
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

    if (
      commodities.length !== skus.length ||
      commodities.length !== quantities.length ||
      commodities.length !== packings.length
    ) {
      return res.status(400).json({ message: "All parameter arrays must be of the same length" });
    }

    // Convert contacts to numbers for matching Contact_Details array in DB
    const contactNumbers = contacts.map(num => Number(num));

    // Step 1: Try to find matching combine sheet data by all parameters
    let combineData = await CombineSheet.find({
      Commodity: { $in: commodities },
      SKU: { $in: skus },
      Contact_Details: { $in: contactNumbers },
      Bag_Packet_Size: { $in: packings },
    });

    // Step 2: If no full match, fallback to matching only by Contact_Details
    if (!combineData.length) {
      console.warn("No full CombineSheet match. Falling back to contact-only match.");

      combineData = await CombineSheet.find({
        Contact_Details: { $in: contactNumbers },
      });

      if (!combineData.length) {
        return res.status(404).json({ message: "No CombineSheet data found for the provided contact(s)" });
      }
    }

    // Map CombineSheet documents to a normalized order-like structure
    const orders = combineData.map(entry => ({
      Commodity: entry.Commodity,
      SKU: entry.SKU,
      Kg: entry.Kg ,
      Price: entry.Price ,
      Shop_Name: entry.Shop_Name || "",
      Buyer_Name: entry.Buyer_Name || "",
      Shop_Number: entry.Shop_Number || "empty",
      Market: entry.Market || "",
      Transport_Expenses: entry.Transport_Expenses || "",
      Unloading_Charges: entry.Unloading_Charges || "",
      Unloading: entry.unloading || "Cash",
    }));
console.log("Orders fetched from CombineSheet:", orders);
    // Now your existing logic for calculations

    const totalOrders = orders.length;
    const totalTransactionPrice = orders.reduce((sum, order) => sum + (parseFloat(order.Price) || 0), 0);
    const totalVolume = orders.reduce((sum, order) => sum + (parseFloat(order.Kg) || 0), 0);
    const averageQuantity = totalVolume / totalOrders;
    const AOV = totalTransactionPrice / totalOrders;

    console.log("Total Orders:", totalOrders);
    console.log("Total Transaction Price:", totalTransactionPrice);
    console.log("Total Volume:", totalVolume);
    console.log("Average Quantity:", averageQuantity);
    console.log("Average Order Value (AOV):", AOV);

    const commoditySkuDetails = [];

    for (let i = 0; i < commodities.length; i++) {
      const commodity = commodities[i].trim();
      const sku = skus[i].trim();
      const qty = quantities[i].trim();
      const packing = packings[i].trim();

      // Filter orders matching this commodity and SKU (case-insensitive)
      const filteredOrders = orders.filter(order =>
        order.Commodity?.toLowerCase() === commodity.toLowerCase() &&
        order.SKU?.toLowerCase() === sku.toLowerCase()
      );

      // Pick the first matching order or fallback to first order overall
      const orderToUse = filteredOrders[0] || orders[0];
      if (!orderToUse) continue;

      // Find pricing data from CommoditySkuPricing model
      const pricingData = await CommoditySkuPricing.findOne({
        commodity_name: new RegExp(`^${commodity}$`, "i"),
        sku_name: new RegExp(`^${sku}$`, "i"),
        typeOfPacking: new RegExp(`^${packing}$`, "i"),
      });

      if (!pricingData) continue;

      const maxPrice = pricingData.max_bag_price;
      const minPrice = pricingData.min_bag_price;
      console.log("Max Price:", maxPrice, "Min Price:", minPrice);

      // Using filteredOrders or fallback order
      const relevantOrders = filteredOrders.length ? filteredOrders : [orderToUse];

      // For now totalInterestCredit hardcoded to 2 (replace with actual calculation if needed)
      const totalInterestCredit = 2;
      const totalInterest = calculateInterestCredit(totalInterestCredit);
      console.log("Total Interest Credit:", totalInterestCredit, "Total Interest:", totalInterest);

      const volumeDiscount = (maxPrice - minPrice) / (parseFloat(orderToUse.Kg) || 1);
      console.log("Volume Discount:", Math.round(volumeDiscount));
      const fx = maxPrice + totalInterest - volumeDiscount;
      console.log("Final FX Price:", fx);

      commoditySkuDetails.push({
        commodity_name: commodity,
        sku_name: sku,
        quantity: qty,
        type_of_packing: packing,
        fx: `${Math.round(fx)} Rs`,
      });
    }

    // Deduplicate by commodity+sku+packing
    const uniqueMap = new Map();
    for (const item of commoditySkuDetails) {
      const key = `${item.commodity_name.toLowerCase()}-${item.sku_name.toLowerCase()}-${item.type_of_packing.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const uniqueCommoditySkuDetails = Array.from(uniqueMap.values());
    console.log("Unique Commodity SKU Details:", uniqueCommoditySkuDetails);

    // Date & time for payload
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

    res.json({ payload });

  } catch (err) {
    console.error("Error in /pricegenerate route:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
