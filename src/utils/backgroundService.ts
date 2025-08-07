interface BackgroundServiceConfig {
  locationInterval: number;
  gestureEnabled: boolean;
  audioEnabled: boolean;
  emergencyContactsEnabled: boolean;
}

export class BackgroundService {
  private static instance: BackgroundService;
  private isRunning = false;
  private config: BackgroundServiceConfig = {
    locationInterval: 10000, // 10 seconds
    gestureEnabled: true,
    audioEnabled: true,
    emergencyContactsEnabled: true
  };
  
  private locationWatchId: number | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private wakeLock: any = null;
  private serviceWorker: ServiceWorker | null = null;

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  async start(childCode?: string): Promise<boolean> {
    if (this.isRunning) {
      console.log('Background service already running');
      return true;
    }

    try {
      // Request wake lock to prevent device sleep
      await this.acquireWakeLock();
      
      // Register service worker for background processing
      await this.registerServiceWorker();
      
      // Start location tracking
      if (childCode) {
        await this.startLocationTracking(childCode);
      }
      
      // Start heartbeat to keep connection alive
      this.startHeartbeat();
      
      // Enable background gesture detection
      this.enableBackgroundGestures();
      
      // Request battery optimization exemption
      await this.requestBatteryOptimizationExemption();
      
      this.isRunning = true;
      console.log('✅ Background service started successfully');
      
      // Show persistent notification (for mobile apps)
      this.showBackgroundNotification();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start background service:', error);
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Stop location tracking
      if (this.locationWatchId) {
        navigator.geolocation.clearWatch(this.locationWatchId);
        this.locationWatchId = null;
      }

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Release wake lock
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }

      // Unregister service worker
      if (this.serviceWorker) {
        this.serviceWorker.postMessage({ type: 'STOP_BACKGROUND_SERVICE' });
      }

      this.isRunning = false;
      console.log('🛑 Background service stopped');
    } catch (error) {
      console.error('Error stopping background service:', error);
    }
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && typeof (navigator as any).wakeLock.request === 'function') {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 Wake lock acquired for background processing');
        
        // Re-acquire wake lock if it's released
        this.wakeLock.addEventListener('release', async () => {
          console.log('🔓 Wake lock released, attempting to re-acquire...');
          if (this.isRunning) {
            try {
              this.wakeLock = await (navigator as any).wakeLock.request('screen');
              console.log('🔒 Wake lock re-acquired');
            } catch (error) {
              console.warn('Failed to re-acquire wake lock:', error);
            }
          }
        });
      } else {
        console.warn('Wake Lock API not supported');
      }
    } catch (error) {
      console.warn('Wake lock not supported or failed:', error);
    }
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('📱 Service worker registered for background processing');
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        
        // Get the active service worker
        this.serviceWorker = registration.active;
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'BACKGROUND_LOCATION_UPDATE':
        this.handleBackgroundLocationUpdate(data);
        break;
      case 'BACKGROUND_GESTURE_DETECTED':
        this.handleBackgroundGesture(data);
        break;
      case 'EMERGENCY_ALERT':
        this.handleEmergencyAlert(data);
        break;
    }
  }

  private async startLocationTracking(childCode: string): Promise<void> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    };

    this.locationWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        await this.handleLocationUpdate(position, childCode);
      },
      (error) => {
        console.error('Background location error:', error);
        // Attempt to restart location tracking after error
        setTimeout(() => {
          if (this.isRunning) {
            this.startLocationTracking(childCode);
          }
        }, 5000);
      },
      options
    );

    console.log('📍 Background location tracking started');
  }

  private async handleLocationUpdate(position: GeolocationPosition, childCode: string): Promise<void> {
    try {
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
      
      let batteryLevel: number | undefined;
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          batteryLevel = battery.level * 100;
        }
      } catch (error) {
        console.warn('Could not get battery level:', error);
      }

      const locationData = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || undefined,
        speed: speed || undefined,
        heading: heading || undefined,
        altitude: altitude || undefined,
        timestamp: Date.now(),
        battery: batteryLevel
      };

      // Send to service worker for background processing
      if (this.serviceWorker) {
        this.serviceWorker.postMessage({
          type: 'LOCATION_UPDATE',
          data: { locationData, childCode }
        });
      }

      // Also handle directly if app is active
      await this.updateFirebaseLocation(locationData, childCode);
      
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  private async updateFirebaseLocation(locationData: any, childCode: string): Promise<void> {
    try {
      const { database } = await import('../config/firebase');
      const { ref, set, push } = await import('firebase/database');

      const childData = {
        lastLocation: locationData,
        status: 'online',
        lastSeen: Date.now(),
        childCode: childCode,
        isActive: true
      };

      await set(ref(database, `children/${childCode}`), childData);
      await push(ref(database, `children/${childCode}/locationHistory`), locationData);
      
      console.log('📍 Location updated in background');
    } catch (error) {
      console.error('Failed to update Firebase location:', error);
      // Queue for offline sync
      const { OfflineManager } = await import('./offlineManager');
      const offlineManager = OfflineManager.getInstance();
      offlineManager.queueAction('location', { childCode, lastLocation: locationData });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Send heartbeat to maintain connection
        if (this.serviceWorker) {
          this.serviceWorker.postMessage({ type: 'HEARTBEAT' });
        }
        
        // Check if app is still responsive
        const timestamp = Date.now();
        localStorage.setItem('safestep_last_heartbeat', timestamp.toString());
        
        console.log('💓 Background heartbeat sent');
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private enableBackgroundGestures(): void {
    // Enable gesture detection that works in background
    if ('DeviceMotionEvent' in window) {
      const handleDeviceMotion = (event: DeviceMotionEvent) => {
        if (!this.isRunning) return;
        
        // Send gesture data to service worker for processing
        if (this.serviceWorker && event.accelerationIncludingGravity) {
          this.serviceWorker.postMessage({
            type: 'GESTURE_DATA',
            data: {
              acceleration: event.accelerationIncludingGravity,
              timestamp: Date.now()
            }
          });
        }
      };

      // Request permission for iOS 13+
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission()
          .then((response: string) => {
            if (response === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
              console.log('🤲 Background gesture detection enabled');
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
        console.log('🤲 Background gesture detection enabled');
      }
    }
  }

  private async requestBatteryOptimizationExemption(): Promise<void> {
    // This would be implemented in the native Android app
    // For web app, we show instructions to user
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('SafeStep Background Service', {
        body: 'For best performance, please disable battery optimization for SafeStep in your device settings.',
        icon: '/Screenshot 2025-07-11 193952 copy.png',
        tag: 'battery-optimization',
        requireInteraction: true
      });
    }
  }

  private showBackgroundNotification(): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('SafeStep Active', {
        body: 'Family safety monitoring is running in the background',
        icon: '/Screenshot 2025-07-11 193952 copy.png',
        tag: 'background-service',
        silent: true,
        persistent: true
      });

      // Keep notification persistent
      notification.onclick = () => {
        window.focus();
      };
    }
  }

  private handleBackgroundLocationUpdate(data: any): void {
    console.log('📍 Background location update received:', data);
    // Handle location update from service worker
  }

  private handleBackgroundGesture(data: any): void {
    console.log('🤲 Background gesture detected:', data);
    // Handle gesture from service worker
  }

  private async handleEmergencyAlert(data: any): Promise<void> {
    console.log('🚨 Emergency alert from background:', data);
    
    // Play emergency sound even in background
    try {
      const { playNotificationSound } = await import('./notifications');
      await playNotificationSound('sos');
    } catch (error) {
      console.error('Failed to play emergency sound:', error);
    }

    // Show emergency notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 EMERGENCY ALERT', {
        body: 'Emergency situation detected! Check SafeStep immediately.',
        icon: '/Screenshot 2025-07-11 193952 copy.png',
        tag: 'emergency',
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
      });
    }
  }

  // Public methods for external control
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  updateConfig(newConfig: Partial<BackgroundServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Send updated config to service worker
    if (this.serviceWorker) {
      this.serviceWorker.postMessage({
        type: 'UPDATE_CONFIG',
        data: this.config
      });
    }
  }

  getConfig(): BackgroundServiceConfig {
    return { ...this.config };
  }

  async forceLocationUpdate(childCode: string): Promise<void> {
    if (!navigator.geolocation) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      await this.handleLocationUpdate(position, childCode);
    } catch (error) {
      console.error('Force location update failed:', error);
    }
  }
}

// Auto-start background service when module loads
const backgroundService = BackgroundService.getInstance();

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('📱 App went to background, maintaining services...');
  } else {
    console.log('📱 App returned to foreground');
    // Ensure background service is still running
    if (!backgroundService.isServiceRunning()) {
      console.log('🔄 Restarting background service...');
      // Service will be restarted by the component that needs it
    }
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  console.log('📱 App is closing, background service will continue...');
  // Don't stop the service on unload for mobile apps
});

export default backgroundService;