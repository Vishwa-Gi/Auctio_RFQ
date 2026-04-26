const mongoose = require('mongoose');

const loggingSchema = new mongoose.Schema({
  seller_id: { type: String, default: null },
  bid_Time: { type: Date, required: true },
  old_closed_time: { type: Date, default: null },
  new_closed_time: { type: Date, default: null },
  RFQ_ID: { type: String, required: true },
  Extension_Reason: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Logging', loggingSchema);
