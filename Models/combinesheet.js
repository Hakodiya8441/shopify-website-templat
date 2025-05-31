const mongoose = require("mongoose");

const combineSheetSchema = new mongoose.Schema({

    Date: { type: Date },
    Shop_Name: { type: String },
    Buyer_Name: { type: String },
    Shop_Number: { type: String },
    Market: { type: String },
    address: { type: String },
    Contact_Details: [{ type: Number }],
    Commodity: { type: String },
    SKU: { type: String },
    Order_Details: { type: String },
    Bag_Packet_Size: { type: String },
    Kg: { type: Number },
    Total_Bags: { type: Number },
    Price: { type: Number },
    Total_Price: { type: Number },
    Transport_Expenses: { type: String },
    Unloading_Charges: { type: String },
    unloading: { type: String },
    Delivery_Date: { type: String },
    Payment_Terms: { type: String },
    RM: { type: String },
    RM_Contact_Details: { type: String }
})
module.exports = mongoose.model("CombineSheet", combineSheetSchema);