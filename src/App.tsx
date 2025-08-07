import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import RoleSelection from './components/RoleSelection';
import ChildTracker from './components/ChildTracker';
import ParentControl from './components/ParentControl';
import { UserRole } from './types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'app'>('landing');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [childCode, setChildCode] = useState<string>('');

  useEffect(() => {
    // Check if app was launched from PWA or APK
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    const mode = urlParams.get('mode');
    
    // If launched from PWA/APK or mobile app mode, skip landing page
    if (source === 'pwa' || mode === 'app' || window.matchMedia('(display-mode: standalone)').matches) {
      setCurrentPage('app');
      console.log('🚀 App launched in mobile mode, skipping landing page');
    }
    
    // Register service worker for background processing
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  useEffect(() => {
    // Generate or retrieve child code when child role is selected
    if (userRole === 'child') {
      let storedCode = localStorage.getItem('safestepChildCode');
      if (!storedCode) {
        storedCode = Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('safestepChildCode', storedCode);
      }
      setChildCode(storedCode);
    }
  }, [userRole]);

  const handleGetStarted = () => {
    setCurrentPage('app');
  };

  const handleRoleSelection = (role: UserRole) => {
    setUserRole(role);
  };

  const resetApp = () => {
    setCurrentPage('landing');
    setUserRole(null);
    setChildCode('');
  };

  if (currentPage === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  if (!userRole) {
    return <RoleSelection onSelectRole={handleRoleSelection} onBack={resetApp} />;
  }

  if (userRole === 'child') {
    return <ChildTracker childCode={childCode} onBack={resetApp} />;
  }

  return <ParentControl onBack={resetApp} />;
}