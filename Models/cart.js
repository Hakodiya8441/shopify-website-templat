const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  Contact_Details: [{ type: Number }],
  Commodity: String,
  SKU: String,
});

module.exports = mongoose.model('Order', cartSchema);