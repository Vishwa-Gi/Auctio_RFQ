require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { initWS } = require('./ws/wsManager');
const rfqRoutes = require('./routes/rfq');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/rfqs', rfqRoutes);

const server = http.createServer(app);
initWS(server);

const RFQ = require('./models/RFQ');
const { broadcast } = require('./ws/wsManager');

async function checkAuctionStatuses() {
  const now = new Date();

  const toForceClose = await RFQ.find({ Auction_Status: 'Active', Bid_Force_Close_Time: { $lt: now } });
  for (const rfq of toForceClose) {
    await RFQ.updateOne({ RFQ_ID: rfq.RFQ_ID }, { $set: { Auction_Status: 'Forced_Close' } });
    broadcast('ListingPage', { event: 'status_update', RFQ_ID: rfq.RFQ_ID, Auction_Status: 'Forced_Close' });
    broadcast('rfq/' + rfq.RFQ_ID, { event: 'status_update', Auction_Status: 'Forced_Close' });
  }

  const toClosed = await RFQ.find({ Auction_Status: 'Active', Bid_Close_Time: { $lt: now } });
  for (const rfq of toClosed) {
    await RFQ.updateOne({ RFQ_ID: rfq.RFQ_ID }, { $set: { Auction_Status: 'Closed' } });
    broadcast('ListingPage', { event: 'status_update', RFQ_ID: rfq.RFQ_ID, Auction_Status: 'Closed' });
    broadcast('rfq/' + rfq.RFQ_ID, { event: 'status_update', Auction_Status: 'Closed' });
  }
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT, () => {
      console.log('Server running on port ' + process.env.PORT);
      setInterval(checkAuctionStatuses, 10000);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
