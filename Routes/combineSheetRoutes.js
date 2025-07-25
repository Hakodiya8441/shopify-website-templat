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
  else if (days >= 6 && days <= 10) rate = 0.50;
  else if (days >= 11 && days <= 15) rate = 1;
  else if (days >= 16 && days <= 20) rate = 1.5;
  else rate = 2;
  return days * rate;
}

router.get("/combine", async (req, res) => {
  console.log("Received query parameters:", req.query);
  try {
    let { commodity_name, sku_name, contact, quantity, typeOfPacking , limitedDeals } = req.query;
    limitedDeals = typeof limitedDeals === 'string' ? parseFloat(limitedDeals) : 0;
    if (isNaN(limitedDeals)) limitedDeals = 0;

    console.log(`limitedDeale`, limitedDeals);

    if (!contact || !quantity || !typeOfPacking || !commodity_name || !sku_name) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // const generateOrderId = req.query.generateOrderId === "true";


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
    console.log("CombineSheet data fetched:", combineData, "entries found");

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
console.log("Orders fetched from CombineSheet:", orders);
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
      const maximumPrice = maxPrice * ( limitedDeals / 100); // Apply limited deals percentage
      console.log(`maximumPrice`, maximumPrice);
      const minPrice = pricingData.min_bag_price;
      const totalInterest = calculateInterestCredit(2);
      const volumeDiscount = (maxPrice - minPrice) / (parseFloat(orderToUse.Kg) || 1);
      const fx = maxPrice + totalInterest - volumeDiscount - maximumPrice; ;

      console.log(`MaxPrice`,maxPrice);
      console.log(`totalIntrest`,totalInterest);
      console.log(`volumeDiscount`, volumeDiscount);
      console.log(`fx`, fx);

    
      


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

    const generateOrderId = req.query.generateOrderId === "true";
    // At the top of your route handler
let orderId = null;


console.log("Generating Order ID:", orderId);
let status = "pending"; // Default status


if (generateOrderId) {
 const orderCounterDoc = await orderCounter.findOneAndUpdate(
   { key: "order_id" },
   { $inc: { value: 1 } },
   { new: true, upsert: true }
 );
 console.log("Order Counter:", orderCounterDoc);
 orderId = orderCounterDoc.value;
 console.log("Generated Order ID:", orderId);
 status = "confirmed";
}
    const uniqueCommoditySkuDetails = Array.from(uniqueMap.values());

    const orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const orderTime = moment().tz("Asia/Kolkata").format("HH:mm:ss");

    const payload = {
      ...(orderId && { order_id: orderId }), // ✅ safely adds only if orderId exists
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
    };

    console.log("Payload to be posted:", payload);

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


// const express = require("express");
// const axios = require("axios");
// const CommoditySkuPricing = require("../Models/comodityPrice");
// const CombineSheet = require("../Models/combinesheet");
// const moment = require("moment-timezone");

// const router = express.Router();

// function calculateInterestCredit(days) {
//   let rate = 0;
//   if (days <= 5) rate = 0.25;
//   else if (days <= 10) rate = 0.5;
//   else if (days <= 15) rate = 1;
//   else if (days <= 20) rate = 1.5;
//   else rate = 2;
//   return days * rate;
// }

// router.get("/combine", async (req, res) => {
//   try {
//     let { commodity_name, sku_name, contact, quantity, typeOfPacking, limitedDeals } = req.query;
//     limitedDeals = parseFloat(limitedDeals) || 0;

//     if (!commodity_name || !sku_name || !contact || !quantity || !typeOfPacking) {
//       return res.status(400).json({ message: "Missing required parameters" });
//     }

//     // Step 1: Convert comma-separated strings into arrays
//     const commodities = commodity_name.split(",").map(str => str.trim());
//     const skus = sku_name.split(",").map(str => str.trim());
//     const quantities = quantity.split(",").map(str => str.trim());
//     const packings = typeOfPacking.split(",").map(str => str.trim());
//     const contacts = contact.split(",").map(str => Number(str.trim()));

//     if (
//       commodities.length !== skus.length ||
//       skus.length !== quantities.length ||
//       quantities.length !== packings.length
//     ) {
//       return res.status(400).json({ message: "All parameter arrays must be of the same length" });
//     }

//     const result = [];

//     for (let i = 0; i < commodities.length; i++) {
//       const commodity = commodities[i];
//       const sku = skus[i];
//       const qty = quantities[i];
//       const packing = packings[i];

//       // Step 2: Try to find exact CombineSheet data for this item
//       let combineData = await CombineSheet.findOne({
//         Commodity: new RegExp(`^${commodity}$`, "i"),
//         SKU: new RegExp(`^${sku}$`, "i"),
//         Bag_Packet_Size: new RegExp(`^${packing}$`, "i"),
//         Contact_Details: { $in: contacts }
//       });

//       // Step 3: If no exact match, fallback to partial (by contact only)
//       if (!combineData) {
//         console.warn(`⚠️ No exact match for ${commodity} - ${sku} - ${packing}, trying contact fallback...`);
//         combineData = await CombineSheet.findOne({
//           Contact_Details: { $in: contacts }
//         });

//         if (!combineData) {
//           console.warn(`❌ Skipping - no CombineSheet match for contact fallback.`);
//           continue; // skip this item if no match at all
//         }
//       }

//       // Step 4: Get pricing info
//       const pricingData = await CommoditySkuPricing.findOne({
//         commodity_name: new RegExp(`^${commodity}$`, "i"),
//         sku_name: new RegExp(`^${sku}$`, "i"),
//         typeOfPacking: new RegExp(`^${packing}$`, "i"),
//       });

//       if (!pricingData) {
//         console.warn(`⚠️ No pricing data found for ${commodity}, ${sku}, ${packing}`);
//         continue;
//       }

//       const maxPrice = pricingData.max_bag_price;
//       const minPrice = pricingData.min_bag_price;
//       const totalInterest = calculateInterestCredit(2);
//       const volumeDiscount = (maxPrice - minPrice) / (parseFloat(combineData.Kg) || 1);
//       const dealDiscount = maxPrice * (limitedDeals / 100);
//       const fx = maxPrice + totalInterest - volumeDiscount - dealDiscount;

//       result.push({
//         commodity_name: commodity,
//         sku_name: sku,
//         quantity: qty,
//         type_of_packing: packing,
//         fx: `${Math.round(fx)} Rs`
//       });
//     }

//     if (result.length === 0) {
//       return res.status(404).json({ message: "No valid results. CombineSheet or pricing data not found." });
//     }

//     return res.status(200).json({
//       success: true,
//       data: result
//     });
//   } catch (err) {
//     console.error("❌ Internal error in /combine:", err);
//     res.status(500).json({ message: "Internal Server Error", error: err.message });
//   }
// });

// module.exports = router;




