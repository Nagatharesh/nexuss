import React, { useState, useEffect } from 'react';
import { OfflineManager } from '../utils/offlineManager';
import { Wifi, WifiOff, Upload, Clock, CheckCircle } from 'lucide-react';

export default function OfflineIndicator() {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: true,
    queuedActions: 0,
    lastSync: Date.now(),
    syncInProgress: false
  });

  const offlineManager = OfflineManager.getInstance();

  useEffect(() => {
    // Initial status
    setSyncStatus(offlineManager.getSyncStatus());

    // Listen for connection changes
    const handleConnectionChange = (isOnline: boolean) => {
      setSyncStatus(offlineManager.getSyncStatus());
    };

    offlineManager.onConnectionChange(handleConnectionChange);

    // Update status periodically
    const interval = setInterval(() => {
      setSyncStatus(offlineManager.getSyncStatus());
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const formatLastSync = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (syncStatus.isOnline && syncStatus.queuedActions === 0) {
    return null; // Don't show indicator when everything is normal
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`glass rounded-2xl px-4 py-3 border transition-all duration-300 ${
        syncStatus.isOnline 
          ? 'border-blue-400/30 bg-blue-500/10' 
          : 'border-red-400/30 bg-red-500/10'
      }`}>
        <div className="flex items-center gap-3">
          {/* Connection Status Icon */}
          <div className="flex items-center gap-2">
            {syncStatus.isOnline ? (
              <Wifi className="w-5 h-5 text-blue-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
            )}
            <span className={`text-sm font-medium ${
              syncStatus.isOnline ? 'text-blue-300' : 'text-red-300'
            }`}>
              {syncStatus.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Sync Status */}
          {syncStatus.queuedActions > 0 && (
            <>
              <div className="w-px h-6 bg-white/20"></div>
              <div className="flex items-center gap-2">
                {syncStatus.syncInProgress ? (
                  <Upload className="w-4 h-4 text-yellow-400 animate-bounce" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-sm text-white/80">
                  {syncStatus.queuedActions} pending
                </span>
              </div>
            </>
          )}

          {/* Last Sync */}
          {syncStatus.isOnline && (
            <>
              <div className="w-px h-6 bg-white/20"></div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/60">
                  {formatLastSync(syncStatus.lastSync)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Offline Message */}
        {!syncStatus.isOnline && (
          <div className="mt-2 text-xs text-white/60">
            App is working offline. Data will sync when connection is restored.
          </div>
        )}

        {/* Sync Progress */}
        {syncStatus.syncInProgress && (
          <div className="mt-2">
            <div className="w-full bg-white/20 rounded-full h-1">
              <div className="bg-blue-400 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}