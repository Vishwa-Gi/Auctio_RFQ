import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TRIGGERS = [
  { value: 'bid_received', label: 'Bid received in last X minutes' },
  { value: 'any_rank_change', label: 'Any supplier rank change in last X minutes' },
  { value: 'l1_rank_change', label: 'L1 (lowest bidder) rank change in last X minutes' }
];

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    user_id: 1,
    RFQ_Name: '',
    Bid_Start_Time: '',
    Bid_Close_Time: '',
    Bid_Force_Close_Time: '',
    Pickup_Date: '',
    Window_Frame: 10,
    Time_Extended: 5,
    Extension_Triggers: ['bid_received']
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTrigger = (value) => {
    setForm(f => {
      const has = f.Extension_Triggers.includes(value);
      return {
        ...f,
        Extension_Triggers: has
          ? f.Extension_Triggers.filter(t => t !== value)
          : [...f.Extension_Triggers, value]
      };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.Extension_Triggers.length === 0) {
      setError('Select at least one extension trigger');
      return;
    }

    if (new Date(form.Bid_Force_Close_Time) <= new Date(form.Bid_Close_Time)) {
      setError('Forced close time must be after bid close time');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-title">Create New RFQ</div>

      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>RFQ Name / Reference ID</label>
            <input
              required
              value={form.RFQ_Name}
              onChange={e => set('RFQ_Name', e.target.value)}
              placeholder="e.g. FREIGHT-2026-001"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bid Start Date & Time</label>
              <input type="datetime-local" required value={form.Bid_Start_Time} onChange={e => set('Bid_Start_Time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Pickup / Service Date</label>
              <input type="datetime-local" required value={form.Pickup_Date} onChange={e => set('Pickup_Date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bid Close Date & Time</label>
              <input type="datetime-local" required value={form.Bid_Close_Time} onChange={e => set('Bid_Close_Time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Forced Bid Close Date & Time</label>
              <input type="datetime-local" required value={form.Bid_Force_Close_Time} onChange={e => set('Bid_Force_Close_Time', e.target.value)} />
            </div>
          </div>

          <div className="section-header">British Auction Configuration</div>

          <div className="form-row">
            <div className="form-group">
              <label>Trigger Window — X (minutes)</label>
              <input type="number" min="1" required value={form.Window_Frame} onChange={e => set('Window_Frame', +e.target.value)} />
            </div>
            <div className="form-group">
              <label>Extension Duration — Y (minutes)</label>
              <input type="number" min="1" required value={form.Time_Extended} onChange={e => set('Time_Extended', +e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Extension Triggers <span style={{ fontWeight: 400, color: '#888' }}>(select all that apply)</span></label>
            {TRIGGERS.map(t => (
              <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontWeight: 400, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.Extension_Triggers.includes(t.value)}
                  onChange={() => toggleTrigger(t.value)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                {t.label}
              </label>
            ))}
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create RFQ'}
          </button>
        </form>
      </div>
    </div>
  );
}
