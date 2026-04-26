const mongoose = require('mongoose');

const rfqSchema = new mongoose.Schema({
  user_id: { type: Number, required: true },
  RFQ_ID: { type: String, required: true, unique: true },
  RFQ_Name: { type: String, required: true },
  Current_Lowest_Bid: { type: Number, default: null },
  Bid_Start_Time: { type: Date, required: true },
  Bid_Close_Time: { type: Date, required: true },
  Bid_Force_Close_Time: { type: Date, required: true },
  Pickup_Date: { type: Date, required: true },
  Auction_Status: {
    type: String,
    enum: ['Active', 'Closed', 'Forced_Close'],
    default: 'Active'
  },
  Window_Frame: { type: Number, required: true },   // X minutes trigger window
  Time_Extended: { type: Number, required: true },  // Y minutes extension duration
  Extension_Triggers: {
    type: [{ type: String, enum: ['bid_received', 'any_rank_change', 'l1_rank_change'] }],
    validate: v => v.length > 0
  }
}, { timestamps: true });

module.exports = mongoose.model('RFQ', rfqSchema);
