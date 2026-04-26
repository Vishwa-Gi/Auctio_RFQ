import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Countdown from '../components/Countdown';

const TRIGGER_LABELS = {
  bid_received: 'Bid received in last X min',
  any_rank_change: 'Any rank change in last X min',
  l1_rank_change: 'L1 rank change in last X min'
};

function statusBadge(status) {
  if (status === 'Active') return <span className="badge badge-active">Active</span>;
  if (status === 'Forced_Close') return <span className="badge badge-forced">Force Closed</span>;
  return <span className="badge badge-closed">Closed</span>;
}

export default function AuctionDetails() {
  const { id } = useParams();
  const [rfq, setRfq] = useState(null);
  const [bids, setBids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [bidForm, setBidForm] = useState({
    Seller_id: '',
    Carrier_NAME: '',
    freight_charges: '',
    origin_charges: '',
    destination_charges: '',
    transit_time: '',
    Validity: ''
  });
  const [alert, setAlert] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const wsRef = useRef(null);

  const load = () => {
    fetch('/api/rfqs/' + id)
      .then(r => r.json())
      .then(d => { setRfq(d.rfq); setBids(d.bids); });
    fetch('/api/rfqs/' + id + '/logs')
      .then(r => r.json())
      .then(setLogs);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5000');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'joinRoom', room: 'rfq/' + id }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === 'bid_update') {
        setBids(msg.bids);
        setRfq(msg.rfq);
        if (msg.extensionTriggered) {
          setFlashing(true);
          setTimeout(() => setFlashing(false), 2000);
          setAlert({ type: 'info', text: 'Auction extended! Reason: ' + msg.extensionReason });
        }
        fetch('/api/rfqs/' + id + '/logs').then(r => r.json()).then(setLogs);
      }

      if (msg.event === 'status_update') {
        setRfq(prev => ({ ...prev, Auction_Status: msg.Auction_Status }));
        setAlert({ type: 'error', text: 'Auction is now ' + msg.Auction_Status.replace('_', ' ') + '. No more bids accepted.' });
      }
    };

    return () => ws.close();
  }, [id]);

  const setField = (k, v) => setBidForm(f => ({ ...f, [k]: v }));

  const submitBid = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (bidForm.Validity && bidForm.transit_time) {
      const transitDays = Number(bidForm.transit_time);
      const validityDate = new Date(bidForm.Validity);
      const deliveryDeadline = new Date(Date.now() + transitDays * 86400000);
      if (validityDate < deliveryDeadline) {
        setAlert({
          type: 'error',
          text: `Quote not possible: quote validity (${validityDate.toLocaleDateString()}) expires before the estimated delivery date (${deliveryDeadline.toLocaleDateString()}, i.e. today + ${transitDays} transit days). The quote must remain valid until delivery is complete.`
        });
        return;
      }
    }

    const body = {
      ...bidForm,
      Seller_id: Number(bidForm.Seller_id),
      freight_charges: Number(bidForm.freight_charges),
      origin_charges: Number(bidForm.origin_charges),
      destination_charges: Number(bidForm.destination_charges)
    };
    try {
      const res = await fetch('/api/rfqs/' + id + '/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAlert({ type: 'success', text: 'Bid submitted successfully!' + (data.extensionTriggered ? ' Auction extended: ' + data.extensionReason : '') });
      setBidForm({ Seller_id: '', Carrier_NAME: '', freight_charges: '', origin_charges: '', destination_charges: '', transit_time: '', Validity: '' });
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    }
  };

  if (!rfq) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>{rfq.RFQ_Name}</div>
        {statusBadge(rfq.Auction_Status)}
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : alert.type === 'success' ? 'success' : 'info'}`}>
          {alert.text}
        </div>
      )}

      <div className="two-col">
        <div>
          {/* Auction Info */}
          <div className={`card ${flashing ? 'extension-flash' : ''}`}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Bid Close Time</div>
                <div style={{ fontWeight: 700 }}>{new Date(rfq.Bid_Close_Time).toLocaleString()}</div>
                {rfq.Auction_Status === 'Active' && <Countdown targetTime={rfq.Bid_Close_Time} />}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Forced Close</div>
                <div style={{ fontWeight: 700 }}>{new Date(rfq.Bid_Force_Close_Time).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Current Lowest Bid</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#27ae60' }}>
                  {rfq.Current_Lowest_Bid != null ? '₹' + rfq.Current_Lowest_Bid.toFixed(2) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Trigger Window (X)</div>
                <div style={{ fontWeight: 700 }}>{rfq.Window_Frame} min</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Extension Duration (Y)</div>
                <div style={{ fontWeight: 700 }}>{rfq.Time_Extended} min</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Extension Triggers</div>
                {(rfq.Extension_Triggers || []).map(t => (
                  <div key={t} style={{ fontWeight: 600, fontSize: '0.85rem' }}>• {TRIGGER_LABELS[t]}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Bids Table */}
          <div className="section-header">Supplier Bids (Ranked)</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Carrier</th>
                  <th>Total Charge</th>
                  <th>Freight</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Transit (days)</th>
                  <th>Validity</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {bids.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888' }}>No bids yet</td></tr>
                )}
                {bids.map(b => (
                  <tr key={b.BID_ID}>
                    <td className={b.Rank === 1 ? 'rank-l1' : ''}>L{b.Rank}</td>
                    <td>{b.Carrier_NAME}</td>
                    <td style={{ fontWeight: 700 }}>₹{b.Bid_details.Charge.toFixed(2)}</td>
                    <td>₹{b.freight_charges}</td>
                    <td>₹{b.origin_charges}</td>
                    <td>₹{b.destination_charges}</td>
                    <td>{b.transit_time}d</td>
                    <td>{new Date(b.Bid_details.Validity).toLocaleDateString()}</td>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(b.Bid_details.Quote_Submit).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Activity Log */}
          <div className="section-header">Activity Log</div>
          <div className="card">
            {logs.length === 0 && <p style={{ color: '#888' }}>No activity yet.</p>}
            {logs.map((log, i) => (
              <div key={i} className="log-entry">
                <div>{log.Extension_Reason}</div>
                {log.old_closed_time && log.new_closed_time && (
                  <div style={{ color: '#e67e22', fontSize: '0.85rem', marginTop: 2 }}>
                    Close time: {new Date(log.old_closed_time).toLocaleTimeString()} → {new Date(log.new_closed_time).toLocaleTimeString()}
                  </div>
                )}
                <div className="log-time">{new Date(log.bid_Time).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bid Submission Panel */}
        <div>
          <div className="section-header">Submit Bid</div>
          <div className="card">
            {rfq.Auction_Status !== 'Active' ? (
              <p style={{ color: '#888' }}>Auction is no longer accepting bids.</p>
            ) : (
              <form onSubmit={submitBid}>
                <div className="form-group">
                  <label>Seller ID</label>
                  <input type="number" required value={bidForm.Seller_id} onChange={e => setField('Seller_id', e.target.value)} placeholder="e.g. 101" />
                </div>
                <div className="form-group">
                  <label>Carrier Name</label>
                  <input required value={bidForm.Carrier_NAME} onChange={e => setField('Carrier_NAME', e.target.value)} placeholder="e.g. DHL" />
                </div>
                <div className="form-group">
                  <label>Freight Charges (₹)</label>
                  <input type="number" step="0.01" required value={bidForm.freight_charges} onChange={e => setField('freight_charges', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Origin Charges (₹)</label>
                  <input type="number" step="0.01" required value={bidForm.origin_charges} onChange={e => setField('origin_charges', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Destination Charges (₹)</label>
                  <input type="number" step="0.01" required value={bidForm.destination_charges} onChange={e => setField('destination_charges', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Transit Time (days to deliver)</label>
                  <input type="number" min="1" required value={bidForm.transit_time} onChange={e => setField('transit_time', e.target.value)} placeholder="e.g. 7" />
                </div>
                <div className="form-group">
                  <label>Quote Validity</label>
                  <input type="datetime-local" required value={bidForm.Validity} onChange={e => setField('Validity', e.target.value)} />
                </div>
                <button className="btn btn-success" type="submit" style={{ width: '100%' }}>Submit Bid</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
