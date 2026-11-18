import React, { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import './styles/globals.css';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard'>('landing');

  return (
    <div className="app-container">
      {currentPage === 'landing' ? (
        <LandingPage onEnterDashboard={() => setCurrentPage('dashboard')} />
      ) : (
        <DashboardPage onBackToHome={() => setCurrentPage('landing')} />
      )}
    </div>
  );
};

export default App;
