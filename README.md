# RFQ British Auction System

A real-time reverse auction platform where buyers post RFQs and suppliers compete by submitting the lowest bid. Built with React, Node.js, MongoDB, and WebSockets.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, React Router v6, Vite   |
| Backend   | Node.js, Express                  |
| Database  | MongoDB, Mongoose                 |
| Real-time | WebSockets (`ws` library)         |

---

## Dependencies

### Backend (`backend/package.json`)

| Package    | Version  | Purpose                              |
|------------|----------|--------------------------------------|
| express    | ^4.18.2  | HTTP server and REST API routing     |
| mongoose   | ^8.3.0   | MongoDB ODM / schema modeling        |
| ws         | ^8.17.0  | WebSocket server                     |
| cors       | ^2.8.5   | Cross-origin request handling        |
| dotenv     | ^16.4.5  | Load environment variables from .env |
| uuid       | ^9.0.0   | Generate unique IDs for RFQ and bids |
| nodemon    | ^3.1.0   | Auto-restart server on file changes (dev) |

### Frontend (`frontend/package.json`)

| Package          | Version  | Purpose                              |
|------------------|----------|--------------------------------------|
| react            | ^18.2.0  | UI library                           |
| react-dom        | ^18.2.0  | React DOM renderer                   |
| react-router-dom | ^6.22.0  | Client-side routing                  |
| vite             | ^5.2.0   | Build tool and dev server            |
| @vitejs/plugin-react | ^4.2.1 | Vite plugin for React/JSX support  |

---

## Project Structure

```
GC/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entry point, Express + WebSocket server
│   │   ├── models/
│   │   │   ├── RFQ.js            # RFQ schema
│   │   │   ├── Seller.js         # Bid/seller schema
│   │   │   └── Logging.js        # Activity log schema
│   │   ├── routes/
│   │   │   └── rfq.js            # All REST API endpoints
│   │   └── ws/
│   │       └── wsManager.js      # WebSocket room management
│   ├── .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ListingPage.jsx   # Auction list with live status updates
    │   │   ├── AuctionDetails.jsx# Bids table, activity log, bid form
    │   │   └── CreateRFQ.jsx     # RFQ creation form
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── Countdown.jsx     # Live countdown timer
    │   └── styles/
    │       └── global.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Prerequisites

- Node.js v18+
- MongoDB running locally on port `27017`

---

## Setup & Running

### 1. Clone and install

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configure environment

`backend/.env`:
```
MONGO_URI="mongodb://localhost:27017/rfq_auction"
PORT=5000
```

### 3. Start servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- WebSocket: ws://localhost:5000

---

## Database Schema

### RFQ
| Field               | Type     | Description                                  |
|---------------------|----------|----------------------------------------------|
| RFQ_ID              | String   | Primary key (UUID)                           |
| user_id             | Number   | Buyer ID                                     |
| RFQ_Name            | String   | RFQ name / reference                         |
| Current_Lowest_Bid  | Number   | Live lowest bid amount                       |
| Bid_Start_Time      | Date     | When bidding opens                           |
| Bid_Close_Time      | Date     | Current auction close time (can extend)      |
| Bid_Force_Close_Time| Date     | Hard deadline — auction never goes past this |
| Pickup_Date         | Date     | Pickup / service date                        |
| Auction_Status      | String   | `Active` / `Closed` / `Forced_Close`         |
| Window_Frame        | Number   | Trigger window X (minutes)                   |
| Time_Extended       | Number   | Extension duration Y (minutes)               |
| Extension_Triggers  | [String] | Active triggers (see below)                  |

### Seller (Bid)
| Field               | Type   | Description                              |
|---------------------|--------|------------------------------------------|
| BID_ID              | String | Primary key (UUID)                       |
| Seller_id           | Number | Supplier ID                              |
| RFQ_ID              | String | Foreign key → RFQ                        |
| Bid_details.Charge  | Number | Total charge (freight + origin + dest)   |
| Bid_details.Validity| Date   | Quote validity date                      |
| Rank                | Number | Current rank (L1 = lowest)               |
| Carrier_NAME        | String | Carrier name                             |
| freight_charges     | Number | Freight charges                          |
| origin_charges      | Number | Origin charges                           |
| destination_charges | Number | Destination charges                      |
| transit_time        | Number | Days to deliver                          |

### Logging
| Field            | Type   | Description                              |
|------------------|--------|------------------------------------------|
| seller_id        | String | Seller who triggered the log entry       |
| bid_Time         | Date   | Timestamp of the event                   |
| old_closed_time  | Date   | Close time before extension (if any)     |
| new_closed_time  | Date   | Close time after extension (if any)      |
| RFQ_ID           | String | Foreign key → RFQ                        |
| Extension_Reason | String | Human-readable reason for the log entry  |

---

## API Endpoints

| Method | Endpoint              | Description                  |
|--------|-----------------------|------------------------------|
| POST   | `/api/rfqs`           | Create a new RFQ             |
| GET    | `/api/rfqs`           | List all RFQs                |
| GET    | `/api/rfqs/:id`       | Get RFQ details + all bids   |
| POST   | `/api/rfqs/:id/bid`   | Submit a bid on an RFQ       |
| GET    | `/api/rfqs/:id/logs`  | Get activity log for an RFQ  |

---

## WebSocket Events

Clients connect to `ws://localhost:5000` and join rooms by sending:

```json
{ "event": "joinRoom", "room": "<room-name>" }
```

### Rooms

| Room           | Join when              |
|----------------|------------------------|
| `ListingPage`  | On the auction list page |
| `rfq/<RFQ_ID>` | On the auction detail page |

### Events received by client

| Event           | Room             | Payload                                                    |
|-----------------|------------------|------------------------------------------------------------|
| `rfq_created`   | ListingPage      | Full RFQ object                                            |
| `bid_update`    | ListingPage      | `{ RFQ_ID, Current_Lowest_Bid, Bid_Close_Time }`           |
| `bid_update`    | rfq/<id>         | `{ bids, rfq, extensionTriggered, extensionReason }`       |
| `status_update` | ListingPage      | `{ RFQ_ID, Auction_Status }`                               |
| `status_update` | rfq/<id>         | `{ Auction_Status }`                                       |

---

## British Auction Logic

### Extension Triggers

When a bid lands inside the **trigger window** (last X minutes before close), the system checks which triggers are active on the RFQ:

| Trigger Key       | Label                                      | Fires when                                |
|-------------------|--------------------------------------------|-------------------------------------------|
| `bid_received`    | Bid received in last X minutes             | Any new bid is placed in the window       |
| `any_rank_change` | Any supplier rank change in last X minutes | Any bid causes a ranking reshuffle        |
| `l1_rank_change`  | L1 rank change in last X minutes           | The lowest-priced supplier changes        |

Multiple triggers can be active. If any fire, the close time extends by **Y minutes**, clamped to the forced close time.

### Validation Rules

- `Bid_Force_Close_Time` must be **after** `Bid_Close_Time`
- Extensions never push the close time past `Bid_Force_Close_Time`
- Quote validity must be **≥ today + transit days** (the quote must still be valid on delivery day)

### Status Auto-Close

The backend polls every **10 seconds** and broadcasts `status_update` via WebSocket when an auction crosses its close or forced-close time, updating all connected clients in real time without requiring a page reload.
