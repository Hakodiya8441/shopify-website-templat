const mongoose = require("mongoose");

const commoditySkuPricingSchema = new mongoose.Schema(
  {
    sku_code: {
      type: String,
      required: true,
      unique: true,
    },
    sku_name: {
      type: String,
      required: true,
    },
    typeOfPacking:{
        type: String,
        required: true,
    },
    min_bag_price: {
      type: Number,
      required: true,
    },
    max_bag_price: {
      type: Number,
      required: true,
    },
    min_bag_quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    max_bag_quantity: {
      type: Number,
      required: true,
      default: 1000,
    },
    commodity_name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CommodityPricingSku", commoditySkuPricingSchema);
