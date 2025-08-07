// SafeStep Service Worker for Background Processing
// Handles location tracking, gesture detection, and emergency alerts when app is in background

const CACHE_NAME = 'safestep-v1';
const BACKGROUND_SYNC_TAG = 'safestep-background-sync';

// Gesture detection state
let gestureState = {
  lastAcceleration: { x: 0, y: 0, z: 0 },
  shakeCount: 0,
  lastShakeTime: 0,
  shakeThreshold: 15,
  shakeWindow: 3000
};

// Background service configuration
let config = {
  locationInterval: 10000,
  gestureEnabled: true,
  audioEnabled: true,
  emergencyContactsEnabled: true
};

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 SafeStep Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/src/main.tsx',
        '/Screenshot 2025-07-11 193952 copy.png'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('✅ SafeStep Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Message handling from main app
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'LOCATION_UPDATE':
      handleLocationUpdate(data);
      break;
    case 'GESTURE_DATA':
      handleGestureData(data);
      break;
    case 'UPDATE_CONFIG':
      config = { ...config, ...data };
      console.log('🔧 Background service config updated:', config);
      break;
    case 'HEARTBEAT':
      handleHeartbeat();
      break;
    case 'STOP_BACKGROUND_SERVICE':
      console.log('🛑 Background service stop requested');
      break;
    default:
      console.log('📨 Unknown message type:', type);
  }
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(syncOfflineData());
  }
});

// Push notifications for emergency alerts
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(handlePushNotification(data));
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes('safestep') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle location updates in background
async function handleLocationUpdate(data) {
  try {
    const { locationData, childCode } = data;
    
    console.log('📍 Processing background location update:', locationData);
    
    // Store location data for offline sync
    await storeOfflineData('location', { locationData, childCode, timestamp: Date.now() });
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      await syncLocationData(locationData, childCode);
    } else {
      // Register for background sync when online
      await self.registration.sync.register(BACKGROUND_SYNC_TAG);
    }
    
    // Notify main app
    notifyClients('BACKGROUND_LOCATION_UPDATE', { locationData, childCode });
    
  } catch (error) {
    console.error('❌ Error handling background location update:', error);
  }
}

// Handle gesture detection in background
function handleGestureData(data) {
  if (!config.gestureEnabled) return;
  
  try {
    const { acceleration, timestamp } = data;
    const { x, y, z } = acceleration;
    
    // Calculate acceleration delta
    const deltaX = Math.abs(x - gestureState.lastAcceleration.x);
    const deltaY = Math.abs(y - gestureState.lastAcceleration.y);
    const deltaZ = Math.abs(z - gestureState.lastAcceleration.z);
    const totalDelta = deltaX + deltaY + deltaZ;
    
    // Detect shake gesture
    if (totalDelta > gestureState.shakeThreshold) {
      const timeSinceLastShake = timestamp - gestureState.lastShakeTime;
      
      if (timeSinceLastShake > 500) { // Minimum 500ms between shakes
        gestureState.shakeCount++;
        gestureState.lastShakeTime = timestamp;
        
        console.log(`🤲 Background shake detected (${gestureState.shakeCount})`);
        
        // Handle different shake patterns
        if (gestureState.shakeCount === 3) {
          handlePanicGesture();
        } else if (gestureState.shakeCount >= 4) {
          handleSOSGesture();
          resetGestureState();
          return;
        }
        
        // Reset shake count after window expires
        setTimeout(() => {
          if (Date.now() - gestureState.lastShakeTime > gestureState.shakeWindow) {
            resetGestureState();
          }
        }, gestureState.shakeWindow);
      }
    }
    
    gestureState.lastAcceleration = { x, y, z };
    
  } catch (error) {
    console.error('❌ Error handling gesture data:', error);
  }
}

// Handle panic gesture (3 shakes)
function handlePanicGesture() {
  console.log('🚨 Panic gesture detected in background');
  
  // Show notification
  self.registration.showNotification('🚨 Panic Siren Activated', {
    body: 'Emergency panic mode activated via gesture',
    icon: '/Screenshot 2025-07-11 193952 copy.png',
    tag: 'panic-gesture',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200]
  });
  
  // Notify main app
  notifyClients('BACKGROUND_GESTURE_DETECTED', { type: 'panic', shakeCount: 3 });
}

// Handle SOS gesture (4+ shakes)
function handleSOSGesture() {
  console.log('🚨 SOS gesture detected in background');
  
  // Show critical notification
  self.registration.showNotification('🚨 SOS ALERT ACTIVATED', {
    body: 'Emergency SOS alert sent via gesture detection',
    icon: '/Screenshot 2025-07-11 193952 copy.png',
    tag: 'sos-gesture',
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300, 100, 300]
  });
  
  // Notify main app and trigger emergency procedures
  notifyClients('EMERGENCY_ALERT', { type: 'sos', source: 'gesture', timestamp: Date.now() });
}

// Reset gesture detection state
function resetGestureState() {
  gestureState.shakeCount = 0;
  gestureState.lastShakeTime = 0;
}

// Handle heartbeat from main app
function handleHeartbeat() {
  console.log('💓 Background heartbeat received');
  // Update last seen timestamp
  self.lastHeartbeat = Date.now();
}

// Sync location data to Firebase
async function syncLocationData(locationData, childCode) {
  try {
    // This would normally use Firebase SDK, but service workers have limitations
    // Instead, we'll use fetch to make direct API calls
    const response = await fetch(`https://safestep-68581-default-rtdb.asia-southeast1.firebasedatabase.app/children/${childCode}.json`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lastLocation: locationData,
        status: 'online',
        lastSeen: Date.now(),
        isActive: true
      })
    });
    
    if (response.ok) {
      console.log('✅ Background location sync successful');
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Background location sync failed:', error);
    // Store for retry
    await storeOfflineData('failed_sync', { locationData, childCode, error: error.message });
  }
}

// Store data for offline sync
async function storeOfflineData(type, data) {
  try {
    const cache = await caches.open('safestep-offline-data');
    const key = `offline-${type}-${Date.now()}`;
    const response = new Response(JSON.stringify(data));
    await cache.put(key, response);
    console.log(`💾 Stored offline data: ${key}`);
  } catch (error) {
    console.error('❌ Failed to store offline data:', error);
  }
}

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    console.log('🔄 Syncing offline data...');
    
    const cache = await caches.open('safestep-offline-data');
    const keys = await cache.keys();
    
    for (const request of keys) {
      if (request.url.includes('offline-')) {
        try {
          const response = await cache.match(request);
          const data = await response.json();
          
          // Process different types of offline data
          if (request.url.includes('offline-location-')) {
            await syncLocationData(data.locationData, data.childCode);
          }
          
          // Remove successfully synced data
          await cache.delete(request);
          console.log('✅ Synced and removed offline data:', request.url);
          
        } catch (error) {
          console.error('❌ Failed to sync offline data:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Offline sync failed:', error);
  }
}

// Handle push notifications
async function handlePushNotification(data) {
  const { title, body, type, urgent } = data;
  
  const options = {
    body,
    icon: '/Screenshot 2025-07-11 193952 copy.png',
    badge: '/Screenshot 2025-07-11 193952 copy.png',
    tag: type,
    requireInteraction: urgent,
    vibrate: urgent ? [300, 100, 300, 100, 300] : [200, 100, 200]
  };
  
  await self.registration.showNotification(title, options);
  
  // Notify main app if it's open
  notifyClients('PUSH_NOTIFICATION_RECEIVED', data);
}

// Notify all connected clients
function notifyClients(type, data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, data });
    });
  });
}

// Periodic background tasks
setInterval(() => {
  // Check if main app is still responsive
  const now = Date.now();
  if (self.lastHeartbeat && (now - self.lastHeartbeat) > 60000) {
    console.log('⚠️ Main app appears unresponsive, maintaining background services');
  }
  
  // Cleanup old offline data
  cleanupOldOfflineData();
}, 60000); // Every minute

// Cleanup old offline data
async function cleanupOldOfflineData() {
  try {
    const cache = await caches.open('safestep-offline-data');
    const keys = await cache.keys();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const request of keys) {
      const urlParts = request.url.split('-');
      const timestamp = parseInt(urlParts[urlParts.length - 1]);
      
      if (now - timestamp > maxAge) {
        await cache.delete(request);
        console.log('🗑️ Cleaned up old offline data:', request.url);
      }
    }
  } catch (error) {
    console.error('❌ Failed to cleanup offline data:', error);
  }
}

console.log('🚀 SafeStep Service Worker loaded and ready for background processing');