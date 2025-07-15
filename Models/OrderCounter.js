// models/OrderCounter.js
const mongoose = require("mongoose");

const orderCounterSchema = new mongoose.Schema({
  key: { type: String, default: "order_id", unique: true },
  value: { type: Number, default: 1000 },
});

module.exports = mongoose.model("OrderCounter", orderCounterSchema);
