const express = require('express');
const router = express.Router();
const Order = require('../Models/cart');


// GET all orders or filtered by contact number
router.get('/customer', async (req, res) => {
  try {
    const contact = req.query.contact;

    console.log(contact);
    const customers = await Customer.find({
      $or: [
        { contact_1: contact },
        { contact_2: { $exists: true, $eq: contact } },
        { contact_3: { $exists: true, $eq: contact } },
      ],
    });

    const modifiedCustomers = customers.map(customer => ({
      ...customer.toObject(),
      shop_name: customer.shop_name.slice(0, 21) + "...",
    }));

    res.status(200).json(modifiedCustomers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;