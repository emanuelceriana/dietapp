import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthGateway from './components/auth/AuthGateway';
import BottomNav from './components/layout/BottomNav';
import HomePage from './pages/HomePage';
import IngredientsPage from './pages/IngredientsPage';
import StatsPage from './pages/StatsPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <AuthGateway>
        <Router>
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/ingredients" element={<IngredientsPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </main>
          <BottomNav />
        </Router>
      </AuthGateway>
    </AuthProvider>
  );
}

export default App;
