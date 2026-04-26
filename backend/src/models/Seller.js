const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  Seller_id: { type: Number, required: true },
  BID_ID: { type: String, required: true, unique: true },
  RFQ_ID: { type: String, required: true },
  Bid_details: {
    Quote_Submit: { type: Date, required: true },
    Charge: { type: Number, required: true },
    Validity: { type: Date, required: true }
  },
  Rank: { type: Number, default: null },
  Carrier_NAME: { type: String, required: true },
  freight_charges: { type: Number, required: true },
  origin_charges: { type: Number, required: true },
  destination_charges: { type: Number, required: true },
  transit_time: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Seller', sellerSchema);
