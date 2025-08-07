import { PermissionManager } from './permissions';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

export function showNotification(message: string, type: NotificationType = 'info') {
  const notification = document.createElement('div');
  
  const colors = {
    info: 'from-blue-500 to-blue-600',
    success: 'from-green-500 to-green-600',
    warning: 'from-yellow-500 to-orange-500',
    error: 'from-red-500 to-red-600'
  };

  const icons = {
    info: '💡',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, ${colors[type].split(' ')[0].replace('from-', '')}, ${colors[type].split(' ')[1].replace('to-', '')});
    color: white;
    padding: 16px 24px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.1);
    z-index: 10000;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 12px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    animation: slideInFromTop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), slideOutToTop 0.5s ease-in 4.5s forwards;
    max-width: 90vw;
  `;

  notification.innerHTML = `
    <span style="font-size: 1.2em;">${icons[type]}</span>
    <span>${message}</span>
  `;
  
  document.body.appendChild(notification);

  // Add animation styles if not already present
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.innerHTML = `
      @keyframes slideInFromTop {
        from { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-50px) scale(0.8); 
        }
        to { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0) scale(1); 
        }
      }
      @keyframes slideOutToTop {
        from { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0) scale(1); 
        }
        to { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-50px) scale(0.8); 
        }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

export function showBrowserNotification(title: string, body: string, icon?: string) {
  if (!PermissionManager.isNotificationPermissionGranted()) {
    console.warn('Browser notification permission not granted');
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/Screenshot 2025-07-11 193952 copy.png',
      badge: '/Screenshot 2025-07-11 193952 copy.png',
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200]
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 8000);
  } catch (error) {
    console.error('Failed to show browser notification:', error);
  }
}

// Professional Emergency Sound Generator
class ProfessionalEmergencyAudio {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private sosOscillators: OscillatorNode[] = [];
  private sosGainNodes: GainNode[] = [];
  private panicBeepInterval: NodeJS.Timeout | null = null;
  private panicOscillators: OscillatorNode[] = [];
  private panicGainNodes: GainNode[] = [];

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.setValueAtTime(1.0, this.audioContext.currentTime); // Maximum volume for emergency
      
      return true;
    } catch (error) {
      console.error('Failed to initialize professional audio:', error);
      return false;
    }
  }

  async playPanicBeep(): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      if (!await this.initialize()) return;
    }

    const now = this.audioContext!.currentTime;
    const beepDuration = 0.3; // 300ms beep
    
    // Create multiple oscillators for maximum loudness and attention
    const frequencies = [800, 1000, 1200, 1600]; // Multiple frequencies for louder, more piercing sound
    
    // Clear any existing panic oscillators
    this.stopPanicBeep();
    
    frequencies.forEach((baseFreq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      const filterNode = this.audioContext!.createBiquadFilter();
      
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain!);
      
      // High-pitched, piercing emergency beep
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.type = 'square'; // Square wave for more aggressive, attention-grabbing sound
      
      // Sharp filter for piercing effect
      filterNode.type = 'highpass';
      filterNode.frequency.setValueAtTime(600, now);
      filterNode.Q.setValueAtTime(3, now);
      
      // Maximum volume for emergency
      const volume = 1.0 / frequencies.length; // Distribute full volume across oscillators
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01); // Sharp attack
      gainNode.gain.linearRampToValueAtTime(volume, now + beepDuration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, now + beepDuration); // Sharp release
      
      oscillator.start(now);
      oscillator.stop(now + beepDuration);
      
      // Store references for cleanup
      this.panicOscillators.push(oscillator);
      this.panicGainNodes.push(gainNode);
    });
  }

  private stopPanicBeep(): void {
    // Stop all panic oscillators
    this.panicOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });
    
    this.panicOscillators = [];
    this.panicGainNodes = [];
  }

  async startContinuousPanicSiren(): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      if (!await this.initialize()) return;
    }

    // Stop any existing panic siren
    this.stopContinuousPanicSiren();
    
    this.isPlaying = true;
    
    // Play initial beep immediately
    await this.playPanicBeep();
    
    // Set up continuous beeping pattern
    this.panicBeepInterval = setInterval(async () => {
      if (this.isPlaying) {
        await this.playPanicBeep();
      }
    }, 500); // Beep every 500ms (fast, urgent pattern)
    
    console.log('🚨 Continuous panic siren started with loud beeps');
  }

  stopContinuousPanicSiren(): void {
    this.isPlaying = false;
    
    if (this.panicBeepInterval) {
      clearInterval(this.panicBeepInterval);
      this.panicBeepInterval = null;
    }
    
    this.stopPanicBeep();
    console.log('🛑 Continuous panic siren stopped');
  }
  async playProfessionalSOS(): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      if (!await this.initialize()) return;
    }

    // Stop any existing SOS sound
    this.stopSOS();

    const now = this.audioContext!.currentTime;
    const duration = 2.0; // 2 seconds continuous sound
    
    // Create multiple oscillators for a rich, loud emergency sound
    const frequencies = [800, 1000, 1200]; // Multiple frequencies for louder, more attention-grabbing sound
    
    frequencies.forEach((baseFreq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      const filterNode = this.audioContext!.createBiquadFilter();
      
      // Create modulation for warbling effect
      const lfoOscillator = this.audioContext!.createOscillator();
      const lfoGain = this.audioContext!.createGain();
      
      // Connect LFO for frequency modulation
      lfoOscillator.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain!);
      
      // Main oscillator settings for emergency sound
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.type = 'sawtooth'; // Sawtooth for more aggressive, attention-grabbing sound
      
      // LFO settings for warbling emergency effect
      lfoOscillator.frequency.setValueAtTime(4 + index, now); // Different modulation rates
      lfoGain.gain.setValueAtTime(50 + (index * 20), now); // Modulation depth
      lfoOscillator.type = 'sine';
      
      // Filter for emergency sound character
      filterNode.type = 'bandpass';
      filterNode.frequency.setValueAtTime(baseFreq * 1.5, now);
      filterNode.Q.setValueAtTime(2, now);
      
      // Louder volume for emergency
      const volume = 1.0 / frequencies.length; // Maximum volume for emergency
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(volume, now + duration - 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
      
      oscillator.start(now);
      oscillator.stop(now + duration);
      lfoOscillator.start(now);
      lfoOscillator.stop(now + duration);
      
      // Store references for cleanup
      this.sosOscillators.push(oscillator, lfoOscillator);
      this.sosGainNodes.push(gainNode, lfoGain);
    });
    
    this.isPlaying = true;
    
    // Auto-cleanup after duration
    setTimeout(() => {
      this.stopSOS();
    }, duration * 1000);
  }

  stopSOS(): void {
    // Stop all SOS oscillators
    this.sosOscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });
    
    this.sosOscillators = [];
    this.sosGainNodes = [];
    this.isPlaying = false;
  }

  async playProfessionalSiren(): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      if (!await this.initialize()) return;
    }

    const now = this.audioContext!.currentTime;
    const duration = 2.5; // Shorter, more professional duration
    
    // Create professional siren with pleasant harmonics
    for (let layer = 0; layer < 2; layer++) {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      const filterNode = this.audioContext!.createBiquadFilter();
      const lfoOscillator = this.audioContext!.createOscillator();
      const lfoGain = this.audioContext!.createGain();
      
      // Connect LFO for frequency modulation
      lfoOscillator.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain!);
      
      // Main oscillator settings
      const baseFreq = layer === 0 ? 440 : 880; // A4 and A5 notes
      oscillator.frequency.setValueAtTime(baseFreq, now);
      oscillator.type = 'sine'; // Pure sine waves for professional sound
      
      // LFO settings for smooth siren sweep
      lfoOscillator.frequency.setValueAtTime(0.8, now); // Moderate sweep
      lfoGain.gain.setValueAtTime(200, now); // Controlled modulation depth
      lfoOscillator.type = 'sine';
      
      // Smooth filter for pleasant sound
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(2000, now);
      filterNode.Q.setValueAtTime(1, now);
      
      // Professional envelope with controlled volume
      const volume = layer === 0 ? 0.7 : 0.5; // Increased volume for better audibility
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(volume, now + duration - 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
      
      oscillator.start(now);
      oscillator.stop(now + duration);
      lfoOscillator.start(now);
      lfoOscillator.stop(now + duration);
    }
  }

  stop(): void {
    this.stopSOS();
    this.stopContinuousPanicSiren();
    this.isPlaying = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
    }
  }
}

const professionalAudio = new ProfessionalEmergencyAudio();

export async function playNotificationSound(soundType: 'message' | 'alert' | 'ping' | 'siren' | 'sos' = 'message') {
  try {
    if (soundType === 'sos') {
      await professionalAudio.playProfessionalSOS();
      console.log('Professional SOS sound played');
      return;
    }
    
    if (soundType === 'siren') {
      await professionalAudio.playProfessionalSiren();
      console.log('Professional siren sound played');
      return;
    }

    // For other sounds, use professional Web Audio API
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported');
    }
    
    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Professional sound configurations with pleasant frequencies
    const configs = {
      message: { freq: 523, duration: 0.3, type: 'sine' as OscillatorType }, // C5 note
      alert: { freq: 659, duration: 0.4, type: 'sine' as OscillatorType }, // E5 note
      ping: { freq: 440, duration: 0.2, type: 'sine' as OscillatorType } // A4 note
    };
    
    const config = configs[soundType as keyof typeof configs] || configs.message;
    
    oscillator.frequency.setValueAtTime(config.freq, audioContext.currentTime);
    oscillator.type = config.type;
    
    // Professional filter settings
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(3000, audioContext.currentTime);
    filterNode.Q.setValueAtTime(0.5, audioContext.currentTime);
    
    // Professional envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + config.duration);
    
    // Clean up audio context after use
    setTimeout(() => {
      audioContext.close().catch(console.warn);
    }, config.duration * 1000 + 100);
    
    console.log(`Professional ${soundType} sound played`);
  } catch (error) {
    console.warn('Professional audio failed, using fallback:', error);
    
    // Enhanced fallback with better audio data
    try {
      const audio = new Audio();
      const sounds = {
        // Professional fallback sounds with better quality
        message: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokTwEAAAAA',
        alert: 'data:audio/wav;base64,UklGRk4EAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YSoEAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokCx',
        ping: 'data:audio/wav;base64,UklGRhIEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YU4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokTwYAAAA=',
        siren: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokTwEAAAAA',
        sos: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmokTwEAAAAA'
      };

      audio.src = sounds[soundType];
      audio.volume = 0.8; // Professional volume level
      await audio.play();
    } catch (fallbackError) {
      console.warn('All audio methods failed:', fallbackError);
    }
  }
}

// Professional Siren Manager
export class SirenManager {
  private static instance: SirenManager;
  private isActive = false;
  private professionalAudio = new ProfessionalEmergencyAudio();

  static getInstance(): SirenManager {
    if (!SirenManager.instance) {
      SirenManager.instance = new SirenManager();
    }
    return SirenManager.instance;
  }

  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log('Professional siren is already active');
      return true;
    }

    try {
      const initialized = await this.professionalAudio.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize professional audio');
      }

      this.isActive = true;
      
      // Start continuous panic beeping
      await this.professionalAudio.startContinuousPanicSiren();

      console.log('🚨 Continuous panic siren with loud beeps started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start panic siren:', error);
      this.isActive = false;
      return false;
    }
  }

  stop(): void {
    this.isActive = false;
    

    this.professionalAudio.stopContinuousPanicSiren();
    console.log('🛑 Panic siren stopped');
  }

  isPlaying(): boolean {
    return this.isActive;
  }
}