import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ListingPage from './pages/ListingPage';
import AuctionDetails from './pages/AuctionDetails';
import CreateRFQ from './pages/CreateRFQ';
import Navbar from './components/Navbar';

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<ListingPage />} />
          <Route path="/create" element={<CreateRFQ />} />
          <Route path="/rfqs/:id" element={<AuctionDetails />} />
        </Routes>
      </div>
    </>
  );
}
