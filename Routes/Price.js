const express = require("express");
const CommoditySkuPricing = require("../Models/comodityPrice");
const axios = require("axios");
const moment = require("moment-timezone");
const router = express.Router();

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

router.get("/pricegenerate", async (req, res) => {
  const query = JSON.parse(JSON.stringify(req.query));
  console.log("Incoming query:", query);

  try {
    
    let { commodity_name, sku_name, contact, quantity, typeOfPacking } = query;

    if (!contact || !quantity || !typeOfPacking || !commodity_name || !sku_name) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const commodities = Array.isArray(commodity_name) ? commodity_name : commodity_name.split(",");
    const skus = Array.isArray(sku_name) ? sku_name : sku_name.split(",");
    const quantities = Array.isArray(quantity) ? quantity : quantity.split(",");
    const packings = Array.isArray(typeOfPacking) ? typeOfPacking : typeOfPacking.split(",");

    if (
      commodities.length !== skus.length ||
      commodities.length !== quantities.length ||
      commodities.length !== packings.length
    ) {
      return res.status(400).json({ message: "All parameter arrays must be of the same length" });
    }

    const response = await axios.get(`http://localhost:2000/api/orders/${contact}`, {
      headers: { "Content-Type": "application/json" },
    });

    let orders = response.data.orders || [];
    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this contact" });
    }

    orders = orders.map(cleanOrderObject);

    const totalOrders = orders.length;
    const totalTransactionPrice = orders.reduce((sum, order) => sum + (parseFloat(order.Total_Price) || 0), 0);
    const totalVolume = orders.reduce((sum, order) => sum + (parseFloat(order.Total_Kg) || 0), 0);
    const averageQuantity = totalVolume / totalOrders;
    const AOV = totalTransactionPrice / totalOrders;

    const commoditySkuDetails = [];

    for (let i = 0; i < commodities.length; i++) {
      const commodity = commodities[i].trim();
      const sku = skus[i].trim();
      const qty = quantities[i].trim();
      const packing = packings[i].trim();

      const filteredOrders = orders.filter(order =>
        order.Commodity?.toLowerCase() === commodity.toLowerCase() &&
        order.SKU?.toLowerCase() === sku.toLowerCase());

      const orderToUse = filteredOrders[0] ||
        orders.find(order => order.Commodity?.toLowerCase() === commodity.toLowerCase()) ||
        orders[0];

      if (!orderToUse) continue;

      const pricingData = await CommoditySkuPricing.findOne({
        commodity_name: new RegExp(`^${commodity}$`, "i"),
        sku_name: new RegExp(`^${sku}$`, "i"),
        typeOfPacking: new RegExp(`^${packing}$`, "i"),
      });

      if (!pricingData) continue;

      const maxPrice = pricingData.max_bag_price;
      const minPrice = pricingData.min_bag_price;

      const relevantOrders = filteredOrders.length ? filteredOrders : [orderToUse];

      // const totalInterestCredit = relevantOrders.reduce((sum, order) =>
      //   sum + (parseFloat(order.Credit_intrest) || 0), 0);
      const totalInterestCredit = 2;
      const totalInterest = calculateInterestCredit(totalInterestCredit);

      const volumeDiscount = (maxPrice - minPrice) / (parseFloat(orderToUse.Total_Kg) || 1);
      const fx = maxPrice + totalInterest - volumeDiscount ;

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
    const orderDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const orderTime = moment().tz("Asia/Kolkata").format("HH:mm:ss");

    const payload = {
      date: orderDate,
      time: orderTime,
      shop_Name: orders[0]?.Shop_Name || "",
      buyer_Name: orders[0]?.Buyer_Name || "",
      shop_Number: orders[0]?.Shop_Number || "empty",
      Market: orders[0]?.Market || "",
      contact_Details: [contact],
      commoditySkuDetails: uniqueCommoditySkuDetails,
      transport_Expenses: orders[0]?.Transport_Expenses || "",
      unloading_Charges: orders[0]?.Unloading_Charges || "",
      unloading: orders[0]?.Unloading || "Cash",
      payment_Terms: "Cash",
    };  
    


    try {
      const postResponse = await axios.post(
        `http://localhost:2000/api/add-template`,
        {pitchedPayload:payload},
        { headers: { "Content-Type": "application/json",
         } }
      );
      console.log("payload posted:", postResponse.data);
    } catch (postErr) {
      if (postErr.response) {
        console.error("Posting failed:", postErr.response.status, postErr.response.data);
        return res.status(postErr.response.status).json(postErr.response.data);
      } else {
        console.error("Posting failed:", postErr.message);
        return res.status(500).json({ message: "Error posting to /template/add-template" });
      }
    }

    res.json({ payload });

  } catch (err) {
    console.error("Error in /pricing route:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;

