import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Countdown from '../components/Countdown';

function statusBadge(status) {
  if (status === 'Active') return <span className="badge badge-active">Active</span>;
  if (status === 'Forced_Close') return <span className="badge badge-forced">Force Closed</span>;
  return <span className="badge badge-closed">Closed</span>;
}

export default function ListingPage() {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/rfqs')
      .then(r => r.json())
      .then(data => { setRfqs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5000');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'joinRoom', room: 'ListingPage' }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.event === 'rfq_created') {
        setRfqs(prev => [msg.rfq, ...prev]);
      }

      if (msg.event === 'bid_update') {
        setRfqs(prev => prev.map(r =>
          r.RFQ_ID === msg.RFQ_ID
            ? { ...r, Current_Lowest_Bid: msg.Current_Lowest_Bid, Bid_Close_Time: msg.Bid_Close_Time }
            : r
        ));
      }

      if (msg.event === 'status_update') {
        setRfqs(prev => prev.map(r =>
          r.RFQ_ID === msg.RFQ_ID
            ? { ...r, Auction_Status: msg.Auction_Status }
            : r
        ));
      }
    };

    return () => ws.close();
  }, []);

  if (loading) return <p>Loading auctions…</p>;

  return (
    <div>
      <div className="page-title">Active Auctions</div>

      {rfqs.length === 0 && (
        <div className="card">No RFQs yet. <a href="/create">Create one</a>.</div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>RFQ Name</th>
              <th>Status</th>
              <th>Current Lowest Bid</th>
              <th>Bid Close Time</th>
              <th>Forced Close</th>
              <th>Countdown</th>
            </tr>
          </thead>
          <tbody>
            {rfqs.map(rfq => (
              <tr key={rfq.RFQ_ID} className="rfq-row" onClick={() => navigate('/rfqs/' + rfq.RFQ_ID)}>
                <td><strong>{rfq.RFQ_Name}</strong><br /><span style={{ fontSize: '0.78rem', color: '#888' }}>{rfq.RFQ_ID.slice(0, 8)}…</span></td>
                <td>{statusBadge(rfq.Auction_Status)}</td>
                <td>{rfq.Current_Lowest_Bid != null ? '₹' + rfq.Current_Lowest_Bid.toFixed(2) : '—'}</td>
                <td>{new Date(rfq.Bid_Close_Time).toLocaleString()}</td>
                <td>{new Date(rfq.Bid_Force_Close_Time).toLocaleString()}</td>
                <td>
                  {rfq.Auction_Status === 'Active'
                    ? <Countdown targetTime={rfq.Bid_Close_Time} />
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
