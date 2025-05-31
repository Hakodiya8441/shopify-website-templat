const express = require("express");
const router = express.Router();
const Order = require("../Models/order"); // Ensure this path is correct


// GET all orders
router.get("/orders", async (req, res) => {
    try {
        // Fetch all orders from the database
        const orders = await Order.find();

        // If no orders are found
        if (orders.length === 0) {
            return res.status(404).json({ message: "No orders found" });
        }

        // Return the orders as JSON
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// GET API to fetch orders by Contact_Details
router.get("/:contact", async (req, res) => {
    try {
        const contact = req.params.contact; // Extract contact number from URL
        console.log("Contact number:", contact);

        // Fetch all orders for the given contact
        const orders = await Order.find({ Contact_Details: contact });

        if (orders.length === 0) {
            return res.status(404).json({ message: "No orders found for this contact number" });
        }
        res.json({
            orders
        });      
    } catch (error) {
        console.error("Error fetching shop stats:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Export the router
module.exports = router;
