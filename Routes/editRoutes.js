// const express = require("express");
// const axios = require("axios");
// const CommoditySkuPricing = require("../Models/comodityPrice");
// const moment = require("moment-timezone");
// const router = express.Router();
// const CombineSheet = require("../Models/combinesheet");

// function calculateInterestCredit(days) {
//   let rate = 0;
//   if (days >= 0 && days <= 5) rate = 0.25;
//   else if (days <= 10) rate = 0.50;
//   else if (days <= 15) rate = 1;
//   else if (days <= 20) rate = 1.5;
//   else rate = 2;
//   return days * rate;
// }

// router.get("/edit", async (req, res) => {
//   try {
//     const { commodity_name, sku_name, contact, quantity, typeOfPacking, price } = req.query;

//     if (!contact || !quantity || !typeOfPacking || !commodity_name || !sku_name || !price) {
//       return res.status(400).json({ message: "Missing required parameters" });
//     }

//     const commodities = Array.isArray(commodity_name) ? commodity_name : commodity_name.split(",");
//     const skus = Array.isArray(sku_name) ? sku_name : sku_name.split(",");
//     const quantities = Array.isArray(quantity) ? quantity : quantity.split(",");
//     const packings = Array.isArray(typeOfPacking) ? typeOfPacking : typeOfPacking.split(",");
//     const contacts = Array.isArray(contact) ? contact : contact.split(",");
//     const prices = Array.isArray(price) ? price : price.split(",").map(p => parseFloat(p));
//     const contactNumbers = contacts.map(num => Number(num));

//     if (
//       commodities.length !== skus.length ||
//       commodities.length !== quantities.length ||
//       commodities.length !== packings.length ||
//       commodities.length !== prices.length
//     ) {
//       return res.status(400).json({ message: "All parameter arrays must be of the same length" });
//     }

//     let combineData = await CombineSheet.find({
//       Commodity: { $in: commodities },
//       SKU: { $in: skus },
//       Contact_Details: { $in: contactNumbers },
//       Bag_Packet_Size: { $in: packings },
//     });

//     if (!combineData.length) {
//       combineData = await CombineSheet.find({ Contact_Details: { $in: contactNumbers } });
//       if (!combineData.length) {
//         return res.status(404).json({ message: "No CombineSheet data found" });
//       }
//     }

//     const orders = combineData.map(entry => ({
//       Commodity: entry.Commodity,
//       SKU: entry.SKU,
//       Kg: entry.Kg,
//       Price: entry.Price,
//       Shop_Name: entry.Shop_Name || "",
//       Buyer_Name: entry.Buyer_Name || "",
//       Shop_Number: entry.Shop_Number || "empty",
//       Market: entry.Market || "",
//       Transport_Expenses: entry.Transport_Expenses || "",
//       Unloading_Charges: entry.Unloading_Charges || "",
//       Unloading: entry.unloading || "Cash",
//     }));

//     const commoditySkuDetails = [];

//     for (let i = 0; i < commodities.length; i++) {
//       const commodity = commodities[i].trim();
//       const sku = skus[i].trim();
//       const qty = parseFloat(quantities[i]);
//       const packing = packings[i].trim();
//       const priceValue = prices[i];

//       const filteredOrders = orders.filter(order =>
//         order.Commodity?.toLowerCase() === commodity.toLowerCase() &&
//         order.SKU?.toLowerCase() === sku.toLowerCase()
//       );

//       const orderToUse = filteredOrders[0] || orders[0];
//       if (!orderToUse) continue;

//       commoditySkuDetails.push({
//         commodity_name: commodity,
//         sku_name: sku,
//         quantity: qty,
//         type_of_packing: packing,
//         fx: `${Math.round(priceValue)} Rs`,
//       });
//     }

//     const uniqueMap = new Map();
//     for (const item of commoditySkuDetails) {
//       const key = `${item.commodity_name.toLowerCase()}-${item.sku_name.toLowerCase()}-${item.type_of_packing.toLowerCase()}`;
//       if (!uniqueMap.has(key)) {
//         uniqueMap.set(key, item);
//       }
//     }

//     let uniqueCommoditySkuDetails = Array.from(uniqueMap.values());

//     let subtotal = uniqueCommoditySkuDetails.reduce((sum, item) => {
//       const price = parseFloat(item.fx.replace(' Rs', ''));
//       return sum + (item.quantity * price);
//     }, 0);

//     const skuPrefixes = ["85", "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96"];
//     let prefixIndex = 0;
//     let attempts = 0;
//     const MAX_ATTEMPTS = 100;

//     while (subtotal < 2000 && attempts < MAX_ATTEMPTS) {
//       const prefix = skuPrefixes[prefixIndex];

//       const additionalProducts = await CommoditySkuPricing.find({
//         sku_code: { $regex: new RegExp(`^${prefix}`) }
//       });

//       if (additionalProducts.length) {
//         for (const product of additionalProducts) {
//           const maxPrice = product.max_bag_price;
//           const totalInterest = calculateInterestCredit(2);
//           const volumeDiscount = (maxPrice - product.min_bag_price);
//           const fx = maxPrice + totalInterest - volumeDiscount;

//           const itemTotal = 10 * fx;
//           if (subtotal + itemTotal > 2000) continue;

//           commoditySkuDetails.push({
//             commodity_name: product.commodity_name,
//             sku_name: product.sku_name,
//             quantity: 10,
//             type_of_packing: product.typeOfPacking,
//             fx: `${Math.round(fx)} Rs`,
//           });

//           subtotal += itemTotal;
//           if (subtotal >= 2000) break;
//           console.log("subtotal",subtotal);
//         }
//       }

//       prefixIndex = (prefixIndex + 1) % skuPrefixes.length;
//       attempts++;
//     }

//     const uniqueCommodities = new Set();
//     for (const item of commoditySkuDetails) {
//       uniqueCommodities.add(item.commodity_name.trim().toLowerCase());
//     }
//     const commodityCount = uniqueCommodities.size;
//     console.log("Unique Commodities Count:", commodityCount);

//     const orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
//     const orderTime = moment().tz("Asia/Kolkata").format("HH:mm:ss");

//     const payload = {
//       date: orderDate,
//       time: orderTime,
//       shop_Name: orders[0]?.Shop_Name || "",
//       buyer_Name: orders[0]?.Buyer_Name || "",
//       shop_Number: orders[0]?.Shop_Number || "empty",
//       Market: orders[0]?.Market || "",
//       contact_Details: contactNumbers,
//       commoditySkuDetails: commoditySkuDetails,
//       transport_Expenses: orders[0]?.Transport_Expenses || "",
//       unloading_Charges: orders[0]?.Unloading_Charges || "",
//       unloading: orders[0]?.Unloading || "Cash",
//       payment_Terms: "Cash",
//       commodity_count: commodityCount,
//     };

//     const postRes = await axios.post("https://shopify-website-template.onrender.com/api/add-template", {
//       pitchedPayload: payload,
//     });

//     res.status(200).json({
//       message: "Pricing generated and posted successfully",
//       postedData: postRes.data,
//     });
//   } catch (err) {
//     console.error("❌ Error in /edit route:", err.message);
//     res.status(500).json({ message: "Internal Server Error", error: err.message });
//   }
// });

// module.exports = router;


const express = require("express");
const axios = require("axios");
const CommoditySkuPricing = require("../Models/comodityPrice");
const moment = require("moment-timezone");
const router = express.Router();
const CombineSheet = require("../Models/combinesheet");
const orderCounter = require("../Models/OrderCounter");

function calculateInterestCredit(days) {
  let rate = 0;
  if (days >= 0 && days <= 5) rate = 0.25;
  else if (days <= 10) rate = 0.50;
  else if (days <= 15) rate = 1;
  else if (days <= 20) rate = 1.5;
  else rate = 2;
  return days * rate;
}

router.get("/edit", async (req, res) => {
  try {
    const { commodity_name, sku_name, contact, quantity, typeOfPacking, price } = req.query;
    const generateOrderId = req.query.generateOrderId === "true";

    if (!contact || !quantity || !typeOfPacking || !commodity_name || !sku_name || !price) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const commodities = Array.isArray(commodity_name) ? commodity_name : commodity_name.split(",");
    const skus = Array.isArray(sku_name) ? sku_name : sku_name.split(",");
    const quantities = Array.isArray(quantity) ? quantity : quantity.split(",");
    const packings = Array.isArray(typeOfPacking) ? typeOfPacking : typeOfPacking.split(",");
    const prices = Array.isArray(price) ? price : price.split(",").map(p => parseFloat(p));
    const contacts = Array.isArray(contact) ? contact : contact.split(",");
    const contactNumbers = contacts.map(num => Number(num));

    if (
      commodities.length !== skus.length ||
      commodities.length !== quantities.length ||
      commodities.length !== packings.length ||
      commodities.length !== prices.length
    ) {
      return res.status(400).json({ message: "All parameter arrays must be of the same length" });
    }

    // 📊 Get CombineSheet order data
    let combineData = await CombineSheet.find({
      Commodity: { $in: commodities },
      SKU: { $in: skus },
      Contact_Details: { $in: contactNumbers },
      Bag_Packet_Size: { $in: packings },
    });

    if (!combineData.length) {
      combineData = await CombineSheet.find({ Contact_Details: { $in: contactNumbers } });
      if (!combineData.length) {
        return res.status(404).json({ message: "No CombineSheet data found" });
      }
    }

    const orders = combineData.map(entry => ({
      Commodity: entry.Commodity,
      SKU: entry.SKU,
      Kg: parseFloat(entry.Kg),
      Price: parseFloat(entry.Price),
      Shop_Name: entry.Shop_Name || "",
      Buyer_Name: entry.Buyer_Name || "",
      Shop_Number: entry.Shop_Number || "empty",
      Market: entry.Market || "",
      Transport_Expenses: entry.Transport_Expenses || "",
      Unloading_Charges: entry.Unloading_Charges || "",
      Unloading: entry.unloading || "Cash",
    }));

    const totalOrders = orders.length;
    const totalVolume = orders.reduce((sum, order) => sum + (order.Kg || 0), 0);
    const totalTransactionPrice = orders.reduce((sum, order) => sum + (order.Price || 0), 0);
    const averageKg = totalVolume / totalOrders;

    const commoditySkuDetails = [];

    // Add user-provided products
    for (let i = 0; i < commodities.length; i++) {
      commoditySkuDetails.push({
        commodity_name: commodities[i].trim(),
        sku_name: skus[i].trim(),
        quantity: parseFloat(quantities[i]),
        type_of_packing: packings[i].trim(),
        fx: `${Math.round(prices[i])} Rs`,
      });
    }

    // 🧹 Remove duplicates
    const uniqueMap = new Map();
    for (const item of commoditySkuDetails) {
      const key = `${item.commodity_name}-${item.sku_name}-${item.type_of_packing}`.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    let uniqueCommoditySkuDetails = Array.from(uniqueMap.values());

    // 🧮 Subtotal check
    let subtotal = uniqueCommoditySkuDetails.reduce((sum, item) => {
      const fx = parseFloat(item.fx.replace(" Rs", ""));
      return sum + fx * item.quantity;
    }, 0);
    console.log("Initial Subtotal:", subtotal);

    let addedProductsCount = 0;
    let addedCommodities = new Set();

    const skuPrefixes = ["85", "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96"];
    let prefixIndex = 0;
    let attempts = 0;

    while (
      (subtotal < 5000 || addedProductsCount < 5 || addedCommodities.size < 5) &&
      attempts < 50
    ) {
      const prefix = skuPrefixes[prefixIndex];
      const products = await CommoditySkuPricing.find({
        sku_code: { $regex: new RegExp(`^${prefix}`) }
      });

      for (const product of products) {
        const maxPrice = product.max_bag_price;
        const minPrice = product.min_bag_price;
        const interest = calculateInterestCredit(2);
        const volumeDiscount = (maxPrice - minPrice) / (averageKg || 1);
        let fx = maxPrice + interest - volumeDiscount;

        const itemQty = 20;
        const itemTotal = fx * itemQty;

        subtotal += itemTotal;
        console.log("Updated Subtotal:", subtotal);
        addedProductsCount++;
        addedCommodities.add(product.commodity_name.trim().toLowerCase());

        uniqueCommoditySkuDetails.push({
          commodity_name: product.commodity_name,
          sku_name: product.sku_name,
          quantity: itemQty,
          type_of_packing: product.typeOfPacking,
          fx: `${Math.round(fx - 1)} Rs`,
        });

        if (subtotal >= 5000 && addedProductsCount >= 5 && addedCommodities.size >= 5) break;
      }

      prefixIndex = (prefixIndex + 1) % skuPrefixes.length;
      attempts++;
    }

    if (!uniqueCommoditySkuDetails.length) {
      return res.status(400).json({ message: "Cannot proceed: No pricing could be generated (commoditySkuDetails is empty)" });
    }

    // 🆔 Generate order ID if needed
    let orderId = null;
    let status = "pending";

    if (generateOrderId) {
      const orderCounterDoc = await orderCounter.findOneAndUpdate(
        { key: "order_id" },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
      );
      orderId = orderCounterDoc.value;
      status = "confirmed";
    }

    const orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const orderTime = moment().tz("Asia/Kolkata").format("HH:mm:ss");

    const payload = {
      ...(orderId && { order_id: orderId }),
      status,
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
      commodity_count: new Set(uniqueCommoditySkuDetails.map(i => i.commodity_name.toLowerCase())).size,
    };

    console.log("✅ Payload to be sent:", payload);

    const postRes = await axios.post("https://shopify-website-template.onrender.com/api/add-template", {
      pitchedPayload: payload,
    });

    res.status(200).json({
      message: "Pricing generated and posted successfully",
      postedData: postRes.data,
    });

  } catch (err) {
    console.error("❌ Error in /edit route:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

module.exports = router;