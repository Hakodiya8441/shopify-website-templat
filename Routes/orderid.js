const express = require("express");
const router = express.Router();
const PitchedPricing = require("../Models/template"); // post api


router.get('/last-orderId',async(req,res)=>{
    console.log("Fetching last order ID...");
    console.log("Request query:", req.query);
    try{
        const lastOrder = await PitchedPricing.findOne().sort({ order_id: -1 });
        if (!lastOrder) {
            return res.json({success:true, order_id:'1000' });//Default start number
        }
        res.json({ success:true, lastOrderId: lastOrder.order_id });
    } catch (error) {
        console.error("Error fetching last order ID:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

module.exports = router;