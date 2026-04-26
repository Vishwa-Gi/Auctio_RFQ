const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const RFQ = require('../models/RFQ');
const Seller = require('../models/Seller');
const Logging = require('../models/Logging');
const { broadcast } = require('../ws/wsManager');

// Create RFQ
router.post('/', async (req, res) => {
  try {
    const {
      user_id, RFQ_Name, Bid_Start_Time, Bid_Close_Time,
      Bid_Force_Close_Time, Pickup_Date, Window_Frame,
      Time_Extended, Extension_Triggers
    } = req.body;

    if (new Date(Bid_Force_Close_Time) <= new Date(Bid_Close_Time)) {
      return res.status(400).json({ error: 'Forced close time must be after bid close time' });
    }
    if (!Extension_Triggers || Extension_Triggers.length === 0) {
      return res.status(400).json({ error: 'At least one extension trigger must be selected' });
    }

    const rfq = new RFQ({
      user_id,
      RFQ_ID: uuidv4(),
      RFQ_Name,
      Bid_Start_Time,
      Bid_Close_Time,
      Bid_Force_Close_Time,
      Pickup_Date,
      Window_Frame,
      Time_Extended,
      Extension_Triggers
    });

    await rfq.save();

    broadcast('ListingPage', { event: 'rfq_created', rfq });
    res.status(201).json(rfq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function syncStatus(rfq) {
  if (rfq.Auction_Status !== 'Active') return rfq;
  const now = new Date();
  let newStatus = null;
  if (now > new Date(rfq.Bid_Force_Close_Time)) {
    newStatus = 'Forced_Close';
  } else if (now > new Date(rfq.Bid_Close_Time)) {
    newStatus = 'Closed';
  }
  if (newStatus) {
    rfq.Auction_Status = newStatus;
    await RFQ.updateOne({ RFQ_ID: rfq.RFQ_ID }, { $set: { Auction_Status: newStatus } });
  }
  return rfq;
}

// Get all RFQs
router.get('/', async (req, res) => {
  try {
    const rfqs = await RFQ.find().sort({ createdAt: -1 });
    await Promise.all(rfqs.map(syncStatus));
    res.json(rfqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single RFQ with bids
router.get('/:id', async (req, res) => {
  try {
    const rfq = await RFQ.findOne({ RFQ_ID: req.params.id });
    if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

    await syncStatus(rfq);
    const bids = await Seller.find({ RFQ_ID: req.params.id }).sort({ 'Bid_details.Charge': 1 });
    res.json({ rfq, bids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit bid
router.post('/:id/bid', async (req, res) => {
  try {
    const rfq = await RFQ.findOne({ RFQ_ID: req.params.id });
    if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

    const now = new Date();

    if (rfq.Auction_Status !== 'Active') {
      return res.status(400).json({ error: 'Auction is not active' });
    }
    if (now > new Date(rfq.Bid_Force_Close_Time)) {
      rfq.Auction_Status = 'Forced_Close';
      await rfq.save();
      return res.status(400).json({ error: 'Auction has passed forced close time' });
    }
    if (now > new Date(rfq.Bid_Close_Time)) {
      return res.status(400).json({ error: 'Auction is closed' });
    }

    const {
      Seller_id, Carrier_NAME, freight_charges, origin_charges,
      destination_charges, transit_time, Validity
    } = req.body;

    const transitDays = Number(transit_time);
    const validityDate = new Date(Validity);
    const deliveryDeadline = new Date(now.getTime() + transitDays * 86400000);
    if (validityDate < deliveryDeadline) {
      return res.status(400).json({
        error: `Quote not possible: quote validity (${validityDate.toLocaleDateString()}) expires before the estimated delivery date (${deliveryDeadline.toLocaleDateString()}, i.e. today + ${transitDays} transit days). The quote must remain valid until delivery is complete.`
      });
    }

    const totalCharge = freight_charges + origin_charges + destination_charges;

    // Get previous L1 before inserting
    const prevBids = await Seller.find({ RFQ_ID: req.params.id }).sort({ 'Bid_details.Charge': 1 });
    const prevL1SellerId = prevBids.length > 0 ? prevBids[0].Seller_id : null;

    const bid = new Seller({
      Seller_id,
      BID_ID: uuidv4(),
      RFQ_ID: req.params.id,
      Bid_details: {
        Quote_Submit: now,
        Charge: totalCharge,
        Validity: new Date(Validity)
      },
      Carrier_NAME,
      freight_charges,
      origin_charges,
      destination_charges,
      transit_time: transitDays
    });

    await bid.save();

    // Recalculate ranks
    const allBids = await Seller.find({ RFQ_ID: req.params.id }).sort({ 'Bid_details.Charge': 1 });
    for (let i = 0; i < allBids.length; i++) {
      allBids[i].Rank = i + 1;
      await allBids[i].save();
    }

    const newL1SellerId = allBids[0].Seller_id;
    rfq.Current_Lowest_Bid = allBids[0].Bid_details.Charge;

    // Extension logic
    const bidCloseTime = new Date(rfq.Bid_Close_Time);
    const forceCloseTime = new Date(rfq.Bid_Force_Close_Time);
    const windowStart = new Date(bidCloseTime.getTime() - rfq.Window_Frame * 60000);
    let extensionTriggered = false;
    let extensionReason = '';

    if (now >= windowStart && now <= bidCloseTime) {
      const triggers = rfq.Extension_Triggers;
      const reasons = [];

      if (triggers.includes('bid_received')) {
        reasons.push(
          `[Trigger A] Bid received in last ${rfq.Window_Frame} minutes — ` +
          `Seller ${Seller_id} (${Carrier_NAME}) submitted a new bid of ₹${totalCharge} ` +
          `at ${now.toLocaleTimeString()} within the trigger window.`
        );
      }

      if (triggers.includes('any_rank_change')) {
        reasons.push(
          `[Trigger B] Supplier rank change in last ${rfq.Window_Frame} minutes — ` +
          `Seller ${Seller_id} (${Carrier_NAME}) placed a bid of ₹${totalCharge} at ${now.toLocaleTimeString()}, ` +
          `causing a reshuffle in supplier rankings.`
        );
      }

      if (triggers.includes('l1_rank_change') && newL1SellerId !== prevL1SellerId) {
        const newL1 = allBids[0];
        reasons.push(
          `[Trigger C] L1 (lowest bidder) changed in last ${rfq.Window_Frame} minutes — ` +
          `Seller ${Seller_id} (${Carrier_NAME}) became the new lowest bidder with ₹${totalCharge} ` +
          `at ${now.toLocaleTimeString()}, displacing the previous L1.`
        );
      }

      if (reasons.length > 0) {
        extensionTriggered = true;
        extensionReason = reasons.join(' | ');
      }

      if (extensionTriggered) {
        const newClose = new Date(bidCloseTime.getTime() + rfq.Time_Extended * 60000);
        const clampedClose = newClose > forceCloseTime ? forceCloseTime : newClose;

        await Logging.create({
          seller_id: String(Seller_id),
          bid_Time: now,
          old_closed_time: bidCloseTime,
          new_closed_time: clampedClose,
          RFQ_ID: req.params.id,
          Extension_Reason: extensionReason
        });

        rfq.Bid_Close_Time = clampedClose;
      }
    }

    // Log the bid submission
    await Logging.create({
      seller_id: String(Seller_id),
      bid_Time: now,
      old_closed_time: null,
      new_closed_time: null,
      RFQ_ID: req.params.id,
      Extension_Reason: 'Bid submitted by seller ' + Seller_id + ' — charge: ' + totalCharge
    });

    await rfq.save();

    const updatedBids = await Seller.find({ RFQ_ID: req.params.id }).sort({ 'Bid_details.Charge': 1 });

    broadcast('ListingPage', {
      event: 'bid_update',
      RFQ_ID: req.params.id,
      Current_Lowest_Bid: rfq.Current_Lowest_Bid,
      Bid_Close_Time: rfq.Bid_Close_Time
    });

    broadcast('rfq/' + req.params.id, {
      event: 'bid_update',
      bids: updatedBids,
      rfq,
      extensionTriggered,
      extensionReason
    });

    res.status(201).json({ bid, rfq, extensionTriggered, extensionReason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get activity logs
router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await Logging.find({ RFQ_ID: req.params.id }).sort({ bid_Time: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
