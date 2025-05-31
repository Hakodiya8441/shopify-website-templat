const express = require('express');
const router = express.Router();
const axios = require('axios');
const Customer = require('../Models/customersheet');

// GET all customers with their matching orders
router.get('/customer', async (req, res) => {
  try {
    const { contact } = req.query;
    console.log(contact);

    if (!contact || contact.length !== 10) {
      return res.status(400).json({ message: "A valid 10-digit contact number is required" });
    }

    // Convert contact to number for comparison
    const contactNumber = Number(contact);

    const customers = await Customer.find({
      $or: [
        { contact_1: contactNumber },
        { contact_2: contactNumber },
        { contact_3: contactNumber },
      ],
    });

    if (customers.length === 0) {
      return res.status(404).json({ message: "No customers found with the given contact number" });
    }

    const modifiedCustomers = customers.map(customer => ({
      ...customer.toObject(),
      shop_name: customer.shop_name.length > 21
        ? customer.shop_name.slice(0, 21) + "..."
        : customer.shop_name,
    }));

    res.status(200).json(modifiedCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
  
  module.exports = router;