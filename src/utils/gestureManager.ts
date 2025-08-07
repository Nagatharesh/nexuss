interface GestureHandlers {
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onShake?: (shakeCount: number) => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
}

export class GestureManager {
  private static instance: GestureManager;
  private handlers: GestureHandlers = {};
  private isEnabled = false;
  
  // Touch tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private lastTap = 0;
  private longPressTimer: NodeJS.Timeout | null = null;
  
  // Shake detection
  private lastAcceleration = { x: 0, y: 0, z: 0 };
  private shakeThreshold = 15;
  private shakeCount = 0;
  private shakeResetTimeout: NodeJS.Timeout | null = null;
  private lastShakeTime = 0;
  private shakeWindow = 3000; // 3 seconds window for multiple shakes
  
  // Gesture thresholds
  private readonly SWIPE_THRESHOLD = 50;
  private readonly SWIPE_VELOCITY_THRESHOLD = 0.3;
  private readonly LONG_PRESS_DURATION = 800;
  private readonly DOUBLE_TAP_DELAY = 300;

  static getInstance(): GestureManager {
    if (!GestureManager.instance) {
      GestureManager.instance = new GestureManager();
    }
    return GestureManager.instance;
  }

  setHandlers(handlers: GestureHandlers) {
    this.handlers = handlers;
  }

  enable() {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    this.setupTouchListeners();
    this.setupShakeDetection();
    console.log('🤲 Gesture controls enabled');
  }

  disable() {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    this.removeTouchListeners();
    this.removeShakeDetection();
    this.resetShakeCount();
    console.log('🤲 Gesture controls disabled');
  }

  private setupTouchListeners() {
    document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
  }

  private removeTouchListeners() {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('touchmove', this.handleTouchMove);
  }

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    
    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this.handlers.onLongPress) {
        this.handlers.onLongPress();
        this.showGestureNotification('Long press detected');
      }
    }, this.LONG_PRESS_DURATION);
  };

  private handleTouchMove = (e: TouchEvent) => {
    // Cancel long press if finger moves
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (e.changedTouches.length !== 1) return;
    
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const touchEndTime = Date.now();
    
    const deltaX = touchEndX - this.touchStartX;
    const deltaY = touchEndY - this.touchStartY;
    const deltaTime = touchEndTime - this.touchStartTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;
    
    // Check for double tap
    if (distance < 10 && deltaTime < 200) {
      const timeSinceLastTap = touchEndTime - this.lastTap;
      if (timeSinceLastTap < this.DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
        if (this.handlers.onDoubleTap) {
          this.handlers.onDoubleTap();
          this.showGestureNotification('Double tap detected');
        }
        return;
      }
      this.lastTap = touchEndTime;
    }
    
    // Check for swipe gestures
    if (distance > this.SWIPE_THRESHOLD && velocity > this.SWIPE_VELOCITY_THRESHOLD) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0 && this.handlers.onSwipeRight) {
          this.handlers.onSwipeRight();
          this.showGestureNotification('Swipe right detected');
        } else if (deltaX < 0 && this.handlers.onSwipeLeft) {
          this.handlers.onSwipeLeft();
          this.showGestureNotification('Swipe left detected');
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && this.handlers.onSwipeDown) {
          this.handlers.onSwipeDown();
          this.showGestureNotification('Swipe down detected');
        }
      }
    }
  };

  private setupShakeDetection() {
    if ('DeviceMotionEvent' in window) {
      // Request permission for iOS 13+
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission()
          .then((response: string) => {
            if (response === 'granted') {
              window.addEventListener('devicemotion', this.handleDeviceMotion);
              console.log('Device motion permission granted');
            } else {
              console.warn('Device motion permission denied');
            }
          })
          .catch((error) => {
            console.error('Device motion permission request failed:', error);
          });
      } else {
        window.addEventListener('devicemotion', this.handleDeviceMotion);
        console.log('Device motion listener added (no permission required)');
      }
    } else {
      console.warn('DeviceMotionEvent not supported');
    }
  }

  private removeShakeDetection() {
    window.removeEventListener('devicemotion', this.handleDeviceMotion);
  }

  private handleDeviceMotion = (e: DeviceMotionEvent) => {
    if (!e.accelerationIncludingGravity || !this.isEnabled) {
      return;
    }
    
    const acceleration = e.accelerationIncludingGravity;
    
    // Validate acceleration values
    const x = typeof acceleration.x === 'number' ? acceleration.x : 0;
    const y = typeof acceleration.y === 'number' ? acceleration.y : 0;
    const z = typeof acceleration.z === 'number' ? acceleration.z : 0;
    
    // Skip if all values are zero (invalid reading)
    if (x === 0 && y === 0 && z === 0) {
      return;
    }
    
    const deltaX = Math.abs(x - this.lastAcceleration.x);
    const deltaY = Math.abs(y - this.lastAcceleration.y);
    const deltaZ = Math.abs(z - this.lastAcceleration.z);
    
    const totalDelta = deltaX + deltaY + deltaZ;
    const currentTime = Date.now();
    
    // Validate totalDelta is a valid number
    if (isNaN(totalDelta) || !isFinite(totalDelta)) {
      return;
    }
    
    if (totalDelta > this.shakeThreshold) {
      // Check if this shake is within the time window
      if (currentTime - this.lastShakeTime > 500) { // Minimum 500ms between shakes
        this.shakeCount++;
        this.lastShakeTime = currentTime;
        
        // Reset the timeout for shake sequence
        if (this.shakeResetTimeout) {
          clearTimeout(this.shakeResetTimeout);
        }
        
        // Show progress notification
        if (this.shakeCount === 1) {
          this.showGestureNotification(`📳 Shake detected (${this.shakeCount}/4 for SOS, ${this.shakeCount}/3 for Panic)`);
        } else if (this.shakeCount === 2) {
          this.showGestureNotification(`📳 Shake ${this.shakeCount}/4 for SOS, ${this.shakeCount}/3 for Panic`);
        } else if (this.shakeCount === 3) {
          this.showGestureNotification(`📳 Panic Siren Activated! (Shake once more for SOS)`);
          if (this.handlers.onShake) {
            this.handlers.onShake(this.shakeCount);
          }
        } else if (this.shakeCount >= 4) {
          this.showGestureNotification(`🚨 SOS Alert Activated!`);
          if (this.handlers.onShake) {
            this.handlers.onShake(this.shakeCount);
          }
          this.resetShakeCount();
          return;
        }
        
        // Reset shake count after window expires
        this.shakeResetTimeout = setTimeout(() => {
          this.resetShakeCount();
        }, this.shakeWindow);
      }
    }
    
    this.lastAcceleration = { x, y, z };
  };

  private resetShakeCount() {
    this.shakeCount = 0;
    if (this.shakeResetTimeout) {
      clearTimeout(this.shakeResetTimeout);
      this.shakeResetTimeout = null;
    }
  }

  private showGestureNotification(message: string) {
    // Import notification utility
    import('../utils/notifications').then(({ showNotification }) => {
      showNotification(message, 'info');
    });
  }

  // Request motion permissions (for iOS)
  async requestMotionPermission(): Promise<boolean> {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        return response === 'granted';
      } catch (error) {
        console.error('Motion permission request failed:', error);
        return false;
      }
    }
    return true; // Permission not required on other platforms
  }

  isGestureEnabled(): boolean {
    return this.isEnabled;
  }
}