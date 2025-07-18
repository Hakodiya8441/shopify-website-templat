const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // ✅ Import cors
const customerRouter = require('./Routes/customer');
const CommodityPricingSku = require('./Routes/comodityPrice');
const orderRoute = require("./Routes/order")
// const price = require('./Routes/Price')
const template = require('./Routes/templateRoutes')
const combine = require('./Routes/combineSheetRoutes')
const edit = require('./Routes/editRoutes')
const orderid = require('./Routes/orderid');

const app = express();

mongoose.connect('mongodb+srv://himanshuakodiya19:RoiCZhadQ4FKGDxv@cluster0.lzon7jv.mongodb.net/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

  // ✅ Use CORS middleware (allow all origins by default)
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.use('/api/orders', cartordersRouter);     // GET /api/orders
app.use('/api', customerRouter);          // GET /api/customer?contactnumber=...
app.use('/api', CommodityPricingSku); // POST /api/pricing
app.use('/api/orders', orderRoute); // GET /api/orders/:contact
// app.use('/api',price); // GET /api/test/pricegenerate?commodity_name=...&sku_name=...&contact=...&quantity=...&volume=...
app.use('/api', template); // POST /api/add-template
app.use('/api', combine);//get api/combine data
app.use('/api', edit); // GET /api/edit?commodity_name=...&sku_name=...&contact=...&quantity=...&typeOfPacking=...&limitedDeals=...&price=...
app.use('/api', orderid); // GET /api/orderid?order_id=...

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
