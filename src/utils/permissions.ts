export class PermissionManager {
  private static notificationPermissionGranted = false;
  private static microphonePermissionGranted = false;
  private static audioContextInitialized = false;

  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.notificationPermissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied by user');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermissionGranted = permission === 'granted';
      
      if (this.notificationPermissionGranted) {
        // Test notification
        new Notification('SafeStep Notifications Enabled', {
          body: 'You will now receive alerts and message notifications',
          icon: '/vite.svg',
          silent: true
        });
      }
      
      return this.notificationPermissionGranted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  static async requestMicrophonePermission(): Promise<boolean> {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
      console.warn('Microphone not supported by browser');
      return false;
    }

    try {
      // Check if permissions API is available
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            this.microphonePermissionGranted = true;
            return true;
          }

          if (permissionStatus.state === 'denied') {
            return false;
          }
        } catch (permError) {
          console.warn('Permissions API query failed:', permError);
          // Continue with getUserMedia attempt
        }
      }

      // Request permission by trying to access microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop the stream immediately after getting access
      stream.getTracks().forEach(track => track.stop());
      
      this.microphonePermissionGranted = true;
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      this.microphonePermissionGranted = false;
      return false;
    }
  }

  static isNotificationPermissionGranted(): boolean {
    return this.notificationPermissionGranted || Notification.permission === 'granted';
  }

  static isMicrophonePermissionGranted(): boolean {
    return this.microphonePermissionGranted;
  }

  static async initializeAudioContext(): Promise<void> {
    if (this.audioContextInitialized) return;

    try {
      // Create and resume audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create a short silent sound to unlock audio
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.01);
      
      this.audioContextInitialized = true;
      console.log('Audio context initialized successfully');
      
      // Close the context after initialization
      setTimeout(() => audioContext.close(), 100);
    } catch (error) {
      console.warn('Audio context initialization failed:', error);
    }
  }

  static async enableAudioOnUserGesture(): Promise<void> {
    // This should be called on user interaction (click, touch, etc.)
    try {
      await this.initializeAudioContext();
      
      // Test audio playback
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokTwEAAAAA';
      audio.volume = 1.0; // Maximum volume for testing
      await audio.play();
      
      console.log('Audio enabled on user gesture');
    } catch (error) {
      console.warn('Failed to enable audio on user gesture:', error);
    }
  }
}