import { PermissionManager } from './permissions';
import { showNotification } from './notifications';

interface VoiceCommandHandler {
  (command: string): Promise<void> | void;
}

export class VoiceCommandManager {
  private isEnabled = false;
  private isListeningForCommand = false;
  private wakeWordRecognition: SpeechRecognition | null = null;
  private commandRecognition: SpeechRecognition | null = null;
  private readonly wakeWords = ['jarvis', 'hey jarvis', 'ok jarvis'];
  private onStatusUpdate: (status: string) => void = () => {};
  private commandHandlers: { [key: string]: VoiceCommandHandler } = {};
  private lastCommandTime = 0;
  private commandCooldown = 2000; // 2 seconds between commands

  constructor(onStatusUpdate: (status: string) => void) {
    this.onStatusUpdate = onStatusUpdate;
  }

  setCommandHandlers(handlers: { [key: string]: VoiceCommandHandler }) {
    this.commandHandlers = handlers;
  }

  async toggle(): Promise<boolean> {
    if (!this.checkBrowserSupport()) {
      return false;
    }

    if (!await this.checkPermissions()) {
      return false;
    }

    this.isEnabled = !this.isEnabled;

    if (this.isEnabled) {
      this.onStatusUpdate(`Listening for "${this.wakeWords.join('", "')}"...`);
      this.startWakeWordRecognition();
      showNotification('🎤 Voice commands enabled - Say "Jarvis" to activate', 'success');
      this.speak('Voice commands activated. Say Jarvis followed by your command.');
    } else {
      this.onStatusUpdate('Voice commands disabled');
      this.stopAllRecognition();
      showNotification('Voice commands disabled', 'info');
      this.speak('Voice commands deactivated.');
    }

    return this.isEnabled;
  }

  private checkBrowserSupport(): boolean {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      showNotification('Speech recognition not supported in this browser', 'error');
      this.onStatusUpdate('Voice commands not supported');
      return false;
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      showNotification('Voice commands require HTTPS', 'error');
      this.onStatusUpdate('HTTPS required for voice commands');
      return false;
    }

    return true;
  }

  private async checkPermissions(): Promise<boolean> {
    if (!PermissionManager.isMicrophonePermissionGranted()) {
      const granted = await PermissionManager.requestMicrophonePermission();
      if (!granted) {
        showNotification('Microphone permission required for voice commands', 'error');
        this.onStatusUpdate('Microphone permission denied');
        return false;
      }
    }
    return true;
  }

  private startWakeWordRecognition(): void {
    this.stopAllRecognition();

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.error('Speech recognition not supported');
      this.onStatusUpdate('Speech recognition not supported in this browser');
      return;
    }
    
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let recognitionTimeout: NodeJS.Timeout;

    recognition.onstart = () => {
      console.log('🎤 Wake word recognition started');
      this.onStatusUpdate(`Listening for "${this.wakeWords.join('", "')}"... (Mic active)`);
      
      recognitionTimeout = setTimeout(() => {
        if (this.isEnabled) {
          recognition.stop();
        }
      }, 30000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      
      const currentTranscript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      console.log('🎤 Heard:', currentTranscript);
      
      for (const wakeWord of this.wakeWords) {
        if (currentTranscript.includes(wakeWord)) {
          console.log(`🎤 Wake word detected: ${wakeWord}`);
          this.speak('Yes, I\'m listening');
          this.onStatusUpdate('Wake word detected! Listening for command...');
          this.isListeningForCommand = true;
          recognition.stop();
          return;
        }
      }
    };

    recognition.onspeechstart = () => {
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      this.onStatusUpdate('Speech detected, checking for wake word...');
    };

    recognition.onend = () => {
      if (this.isListeningForCommand) {
        this.startCommandRecognition();
      } else if (this.isEnabled && PermissionManager.isMicrophonePermissionGranted()) {
        setTimeout(() => this.startWakeWordRecognition(), 500);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      
      console.error('Wake word recognition error:', event.error);
      this.handleRecognitionError(event.error, 'wake word');
    };

    try {
      recognition.start();
      this.wakeWordRecognition = recognition;
    } catch (error) {
      console.error('Failed to start wake word recognition:', error);
      this.onStatusUpdate('Failed to start voice commands');
    }
  }

  private startCommandRecognition(): void {
    const recognition = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      console.log('🎤 Command recognition started');
      this.onStatusUpdate('Listening for your command... (Mic active)');
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const command = event.results[0][0].transcript.toLowerCase().trim();
      console.log('🎤 Command received:', command);
      this.onStatusUpdate(`Command received: "${command}"`);
      
      await this.handleCommand(command);
    };

    recognition.onend = () => {
      this.isListeningForCommand = false;
      if (this.isEnabled && PermissionManager.isMicrophonePermissionGranted()) {
        this.onStatusUpdate(`Listening for "${this.wakeWords.join('", "')}"...`);
        setTimeout(() => this.startWakeWordRecognition(), 500);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Command recognition error:', event.error);
      this.isListeningForCommand = false;
      this.handleRecognitionError(event.error, 'command');
    };

    try {
      recognition.start();
      this.commandRecognition = recognition;
    } catch (error) {
      console.error('Failed to start command recognition:', error);
      this.onStatusUpdate('Failed to start command recognition');
    }
  }

  private async handleCommand(command: string): Promise<void> {
    // Check cooldown to prevent rapid-fire commands
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandCooldown) {
      this.speak('Please wait a moment before the next command.');
      return;
    }
    this.lastCommandTime = now;

    let commandFound = false;
    let executedCommand = '';

    // Enhanced command matching with multiple variations
    const commandPatterns = [
      // Emergency commands (Child)
      { patterns: ['send sos', 'sos', 'emergency', 'help me', 'need help', 'call for help'], key: 'send sos' },
      
      // Panic siren commands (Child)
      { patterns: ['enable panic siren', 'start siren', 'siren on', 'panic siren', 'enable panic', 'start panic', 'panic beeping', 'start beeping', 'loud beeping'], key: 'enable panic siren' },
      { patterns: ['disable panic siren', 'stop siren', 'siren off', 'stop panic', 'disable panic', 'stop beeping', 'stop loud beeping'], key: 'disable panic siren' },
      
      // Safety messages (Child)
      { patterns: ['i am safe', 'i\'m safe', 'safe', 'all good', 'everything is fine'], key: 'i am safe' },
      { patterns: ['coming home', 'going home', 'on my way home', 'heading home'], key: 'coming home' },
      { patterns: ['need pickup', 'need a ride', 'pick me up', 'come get me'], key: 'need pickup' },
      
      // Parent location commands
      { patterns: ['where is my child', 'child location', 'where is child', 'child\'s location', 'find my child'], key: 'where is my child' },
      { patterns: ['child battery', 'battery level', 'what is battery', 'child\'s battery', 'battery status'], key: 'child battery' },
      
      // Parent communication commands
      { patterns: ['are you okay', 'are you ok', 'check on child'], key: 'are you okay' },
      { patterns: ['on my way', 'coming to get you', 'be right there'], key: 'on my way' },
      { patterns: ['call me', 'phone me', 'give me a call'], key: 'call me' },
      { patterns: ['ping child', 'send ping', 'check child'], key: 'ping child' }
    ];

    // Find matching command pattern
    for (const pattern of commandPatterns) {
      for (const patternText of pattern.patterns) {
        if (command.includes(patternText)) {
          const handler = this.commandHandlers[pattern.key];
          if (handler) {
            commandFound = true;
            executedCommand = pattern.key;
            try {
              await handler(command);
              this.onStatusUpdate(`✅ Command executed: "${pattern.key}"`);
              this.speak(`Command executed: ${pattern.key.replace(/([a-z])([A-Z])/g, '$1 $2')}`);
            } catch (error) {
              console.error(`Error executing command "${pattern.key}":`, error);
              this.speak('Sorry, I encountered an error executing that command.');
              this.onStatusUpdate(`❌ Error executing command: "${pattern.key}"`);
            }
            break;
          }
        }
      }
      if (commandFound) break;
    }

    if (!commandFound) {
      this.onStatusUpdate(`❓ Command not recognized: "${command}"`);
      this.speak(`Sorry, I didn't understand "${command}". Try commands like "send SOS", "where is my child", or "battery level".`);
      
      // Show available commands based on context
      setTimeout(() => {
        const hasChildCommands = Object.keys(this.commandHandlers).some(key => 
          ['send sos', 'enable panic siren', 'i am safe'].includes(key)
        );
        
        const hasParentCommands = Object.keys(this.commandHandlers).some(key => 
          ['where is my child', 'child battery', 'ping child'].includes(key)
        );

        if (hasChildCommands) {
          showNotification('Child commands: "send SOS", "enable panic siren", "I am safe", "coming home", "need pickup"', 'info');
        } else if (hasParentCommands) {
          showNotification('Parent commands: "where is my child", "child battery", "ping child", "are you okay"', 'info');
        }
      }, 2000);
    }
  }

  private handleRecognitionError(error: string, type: string): void {
    switch (error) {
      case 'not-allowed':
      case 'permission-denied':
        showNotification('Microphone permission denied', 'error');
        this.onStatusUpdate('Microphone permission denied');
        this.isEnabled = false;
        this.speak('Microphone permission denied. Voice commands disabled.');
        break;
      case 'no-speech':
        if (this.isEnabled) {
          this.onStatusUpdate(`No speech detected. Listening for "${this.wakeWords.join('", "')}"...`);
        }
        break;
      case 'audio-capture':
        showNotification('Audio capture error. Check your microphone.', 'error');
        this.onStatusUpdate('Audio capture error');
        this.speak('Audio capture error. Please check your microphone.');
        break;
      case 'abandoned':
        if (this.isEnabled) {
          this.onStatusUpdate(`Voice recognition abandoned. Say "${this.wakeWords.join('", "')}" to retry.`);
        }
        break;
      case 'network':
        showNotification('Network error during voice recognition', 'error');
        this.onStatusUpdate('Network error during voice recognition');
        break;
      default:
        if (this.isEnabled) {
          showNotification(`Voice recognition error: ${error}`, 'error');
          this.onStatusUpdate(`Error: ${error}`);
        }
    }

    if (this.isEnabled && PermissionManager.isMicrophonePermissionGranted()) {
      setTimeout(() => this.startWakeWordRecognition(), 1000);
    }
  }

  private speak(text: string): void {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.volume = 0.8;
      utterance.pitch = 1.0;
      
      // Use a more natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Microsoft'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }

  private stopAllRecognition(): void {
    if (this.wakeWordRecognition) {
      this.wakeWordRecognition.stop();
      this.wakeWordRecognition = null;
    }
    if (this.commandRecognition) {
      this.commandRecognition.stop();
      this.commandRecognition = null;
    }
    this.isListeningForCommand = false;
  }

  disable(): void {
    this.isEnabled = false;
    this.stopAllRecognition();
    this.onStatusUpdate('Voice commands disabled');
    this.speak('Voice commands disabled.');
  }

  isVoiceEnabled(): boolean {
    return this.isEnabled;
  }

  // Test method for debugging
  testCommand(command: string): void {
    console.log('🧪 Testing command:', command);
    this.handleCommand(command);
  }

  // Get available commands for current context
  getAvailableCommands(): string[] {
    return Object.keys(this.commandHandlers);
  }
}