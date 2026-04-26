import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <h1>RFQ British Auction</h1>
      <Link to="/">Auctions</Link>
      <Link to="/create">+ New RFQ</Link>
    </nav>
  );
}
