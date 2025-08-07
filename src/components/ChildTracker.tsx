import React, { useState, useEffect, useRef } from 'react';
import { ref, set, push, onValue } from 'firebase/database';
import { database } from '../config/firebase';
import { getCurrentLocation, watchLocation } from '../utils/location';
import { VoiceCommandManager } from '../utils/voiceCommands';
import { PermissionManager } from '../utils/permissions';
import { showNotification, playNotificationSound, showBrowserNotification, SirenManager } from '../utils/notifications';
import { OfflineManager } from '../utils/offlineManager';
import { GestureManager } from '../utils/gestureManager';
import { EmergencyContactManager } from '../utils/emergencyContacts';
import backgroundService from '../utils/backgroundService';
import { Location, ChatMessage } from '../types';
import { Mic, MicOff, AlertTriangle, Volume2, VolumeX, ArrowLeft, Bell, Shield, Zap, Sparkles } from 'lucide-react';
import FloatingChat from './FloatingChat';
import OfflineIndicator from './OfflineIndicator';
import Logo from './Logo';
import VoiceCommandTester from './VoiceCommandTester';

interface ChildTrackerProps {
  childCode: string;
  onBack: () => void;
}

export default function ChildTracker({ childCode, onBack }: ChildTrackerProps) {
  const [status, setStatus] = useState('Initializing...');
  const [location, setLocation] = useState<Location | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('Voice commands disabled');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showPingNotification, setShowPingNotification] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(false);
  const [showVoiceTester, setShowVoiceTester] = useState(false);
  
  const voiceManagerRef = useRef<VoiceCommandManager | null>(null);
  const gestureManagerRef = useRef<GestureManager>(GestureManager.getInstance());
  const offlineManagerRef = useRef<OfflineManager>(OfflineManager.getInstance());
  const emergencyManagerRef = useRef<EmergencyContactManager>(EmergencyContactManager.getInstance());
  const watchIdRef = useRef<number | null>(null);
  const sirenManagerRef = useRef<SirenManager>(SirenManager.getInstance());
  const lastMessageCountRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  const backgroundIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsVisible(true);
    initializePermissions();
    startLocationTracking();
    setupVoiceCommands();
    setupGestureControls();
    setupOfflineManager();
    setupFirebaseListeners();
    startBackgroundService();
    
    return () => {
      cleanup();
    };
  }, [childCode]);

  const initializePermissions = async () => {
    try {
      await PermissionManager.requestNotificationPermission();
      await PermissionManager.requestMicrophonePermission();
      await PermissionManager.initializeAudioContext();
      
      const testButton = document.createElement('button');
      testButton.style.display = 'none';
      document.body.appendChild(testButton);
      
      testButton.addEventListener('click', async () => {
        try {
          await playNotificationSound('ping');
          console.log('Audio test successful');
        } catch (error) {
          console.warn('Audio test failed:', error);
        }
        document.body.removeChild(testButton);
      });
      
      testButton.click();
    } catch (error) {
      console.error('Permission initialization failed:', error);
      showNotification('Some features may not work properly. Please allow permissions when prompted.', 'warning');
    }
  };

  const startLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setStatus('Getting location...');
    
    watchIdRef.current = watchLocation(
      async (locationData) => {
        setLocation(locationData);
        setStatus(`Location found! Accuracy: ${locationData.accuracy?.toFixed(0) || 'N/A'}m`);
        setIsOnline(true);
        
        const childData = {
          lastLocation: locationData,
          status: 'online',
          lastSeen: Date.now(),
          childCode: childCode,
          isActive: true
        };
        
        await set(ref(database, `children/${childCode}`), childData);
        await push(ref(database, `children/${childCode}/locationHistory`), locationData);
      },
      (error) => {
        console.error('Location error:', error);
        setStatus('Location error: ' + error.message);
        setIsOnline(false);
        set(ref(database, `children/${childCode}/status`), 'offline');
      }
    );
  };

  const startBackgroundService = async () => {
    try {
      // Start comprehensive background service
      const started = await backgroundService.start(childCode);
      if (started) {
        showNotification('🛡️ Background protection activated', 'success');
        console.log('✅ Background service started for child tracker');
      } else {
        showNotification('⚠️ Background protection limited - some features may not work when app is closed', 'warning');
      }
    } catch (error) {
      console.error('Failed to start background service:', error);
      showNotification('⚠️ Background service failed to start', 'warning');
    }
  };

  const setupVoiceCommands = () => {
    const voiceManager = new VoiceCommandManager(setVoiceStatus);
    
    voiceManager.setCommandHandlers({
      // Emergency SOS commands
      'send sos': handleSendSOS,
      
      // Panic siren commands
      'enable panic siren': () => togglePanicSiren(true),
      'disable panic siren': () => togglePanicSiren(false),
      
      // Safety status messages
      'i am safe': () => sendQuickMessage('I am safe!'),
      'coming home': () => sendQuickMessage('Coming home.'),
      'need pickup': () => sendQuickMessage('Need to be picked up.')
    });
    
    voiceManagerRef.current = voiceManager;
  };

  const setupGestureControls = async () => {
    const gestureManager = gestureManagerRef.current;
    
    gestureManager.setHandlers({
      onShake: (shakeCount: number) => {
        if (shakeCount === 3) {
          // 3 shakes = activate panic siren
          togglePanicSiren(true);
        } else if (shakeCount >= 4) {
          // 4+ shakes = send SOS
          handleSendSOS();
        }
      },
      onLongPress: () => sendQuickMessage('I need help!'),
      onDoubleTap: () => sendQuickMessage('I am safe!')
    });

    // Request motion permission for shake detection
    const motionGranted = await gestureManager.requestMotionPermission();
    if (motionGranted) {
      gestureManager.enable();
      setGesturesEnabled(true);
      showNotification('🤲 Gesture controls enabled! Shake 3x for panic siren, shake 4x for SOS alert', 'success');
    }
  };

  const setupOfflineManager = () => {
    const offlineManager = offlineManagerRef.current;
    
    offlineManager.onConnectionChange((isOnline) => {
      setIsOffline(!isOnline);
      if (isOnline) {
        showNotification('🌐 Connection restored - syncing data...', 'success');
      } else {
        showNotification('📴 Working offline - data will sync when connected', 'info');
      }
    });
  };

  const setupFirebaseListeners = () => {
    const pingRef = ref(database, `children/${childCode}/ping`);
    onValue(pingRef, (snapshot) => {
      const pingData = snapshot.val();
      if (pingData && pingData.timestamp) {
        setShowPingNotification(true);
        playNotificationSound('ping');
        showBrowserNotification('Parent Ping!', 'Your parent is checking on you', '/logo.svg');
        setTimeout(() => setShowPingNotification(false), 3000);
        set(pingRef, null);
      }
    });

    const messagesRef = ref(database, `chats/${childCode}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.values(data) as ChatMessage[];
        messageList.sort((a, b) => a.timestamp - b.timestamp);
        
        const currentMessageCount = messageList.length;
        const previousMessageCount = lastMessageCountRef.current;
        
        if (currentMessageCount > previousMessageCount) {
          const newMessages = messageList.slice(previousMessageCount);
          const parentMessages = newMessages.filter(message => message.sender === 'parent');
          
          if (parentMessages.length > 0) {
            setUnreadMessages(prev => prev + parentMessages.length);
            playNotificationSound('message');
            showNotification('💬 New message from Parent!', 'info');
            showBrowserNotification(
              'New message from Parent',
              parentMessages[parentMessages.length - 1].text,
              '/Screenshot 2025-07-11 193952 copy.png'
            );
          }
        }
        
        lastMessageCountRef.current = currentMessageCount;
        setMessages(messageList);
      }
    });
  };

  const handleSendSOS = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      const offlineManager = offlineManagerRef.current;
      const emergencyManager = emergencyManagerRef.current;
      
      const sosData = {
        timestamp: Date.now(),
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        accuracy: currentLocation.accuracy || 0,
        childCode: childCode,
        status: 'active'
      };
      
      if (offlineManager.isConnected()) {
        await push(ref(database, 'sosAlerts'), sosData);
      } else {
        offlineManager.queueAction('sos', sosData);
      }
      
      // Send emergency alerts to contacts
      await emergencyManager.sendEmergencyAlert(
        'sos',
        childCode,
        { lat: currentLocation.lat, lng: currentLocation.lng, accuracy: currentLocation.accuracy }
      );
      
      // Play professional SOS sound
      await playNotificationSound('sos');
      
      showNotification('🚨 SOS ALERT SENT! 🚨', 'success');
      showBrowserNotification('🚨 SOS Alert Sent!', 'Emergency alert has been sent to your parent', '/logo.svg');
      showBrowserNotification('🚨 SOS Alert Sent!', 'Emergency alert has been sent to your parent', '/Screenshot 2025-07-11 193952 copy.png');
    } catch (error) {
      console.error('Failed to send SOS:', error);
      showNotification('Failed to send SOS: ' + (error as Error).message, 'error');
    }
  };

  const togglePanicSiren = async (enable?: boolean) => {
    const shouldEnable = enable !== undefined ? enable : !isSirenActive;
    const sirenManager = sirenManagerRef.current;
    
    if (shouldEnable && !isSirenActive) {
      // Start continuous loud panic beeping
      const started = await sirenManager.start();
      if (started) {
        setIsSirenActive(true);
        showNotification('🚨 PANIC BEEPING ACTIVATED! LOUD CONTINUOUS BEEPS! 🚨', 'warning');
        showBrowserNotification('🚨 PANIC BEEPING ACTIVE', 'Loud continuous emergency beeps are now playing', '/Screenshot 2025-07-11 193952 copy.png');
      } else {
        showNotification('❌ Failed to start panic beeping. Please try again.', 'error');
      }
    } else if (!shouldEnable && isSirenActive) {
      sirenManager.stop();
      setIsSirenActive(false);
      showNotification('🛑 Panic beeping stopped', 'info');
    }
  };

  const toggleVoiceCommands = async () => {
    if (voiceManagerRef.current) {
      const enabled = await voiceManagerRef.current.toggle();
      setIsVoiceEnabled(enabled);
    }
  };

  const sendQuickMessage = async (message: string) => {
    const offlineManager = offlineManagerRef.current;
    const messageData = {
      sender: 'child' as const,
      text: message,
      timestamp: Date.now()
    };
    
    if (offlineManager.isConnected()) {
      await push(ref(database, `chats/${childCode}/messages`), messageData);
    } else {
      offlineManager.queueAction('message', { childCode, message: messageData });
      offlineManager.storeOfflineData('messages', messageData);
    }
    
    showNotification('Message sent!', 'success');
    playNotificationSound('message');
  };

  const cleanup = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Stop background service safely
    try {
      backgroundService.stop();
    } catch (error) {
      console.warn('Error stopping background service:', error);
    }
    
    if (sirenManagerRef.current) {
      try {
        sirenManagerRef.current.stop();
      } catch (error) {
        console.warn('Error stopping siren:', error);
      }
    }
    
    if (voiceManagerRef.current) {
      try {
        voiceManagerRef.current.disable();
      } catch (error) {
        console.warn('Error disabling voice commands:', error);
      }
    }
    
    if (gestureManagerRef.current) {
      try {
        gestureManagerRef.current.disable();
      } catch (error) {
        console.warn('Error disabling gestures:', error);
      }
    }
    
    // Clear any remaining intervals
    if (backgroundIntervalRef.current) {
      clearInterval(backgroundIntervalRef.current);
      backgroundIntervalRef.current = null;
    }
  };

  const handleUserInteraction = async () => {
    try {
      await PermissionManager.initializeAudioContext();
      await playNotificationSound('ping');
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  };

  const handleChatOpen = () => {
    setUnreadMessages(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <div className={`relative z-10 bg-white/10 backdrop-blur-sm border-b border-white/20 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-110"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} animate={true} />
            <div className="text-center">
              <h1 className="text-lg font-semibold text-white">SafeStep Tracker</h1>
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-white/80">Code: {childCode}</span>
              </div>
            </div>
          </div>
          
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Status Card */}
        <div className={`glass rounded-2xl p-8 mb-8 border border-white/20 transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 relative" onClick={handleUserInteraction}>
              <div className="radar-container cursor-pointer hover:scale-110 transition-transform duration-300 mx-auto">
                <div className="radar-sweep"></div>
                <div className="radar-dot"></div>
                <div className="absolute inset-0 border-2 border-blue-400/30 rounded-full animate-pulse-ring"></div>
                <div className="absolute inset-4 border-2 border-purple-400/20 rounded-full animate-pulse-ring" style={{ animationDelay: '0.5s' }}></div>
                <Zap className="absolute top-1/2 left-1/2 w-10 h-10 text-blue-400 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
              Location Tracking Active
            </h2>
            <p className="text-white/80 mb-6 text-lg">{status}</p>
            
            <div className="w-full bg-white/20 rounded-full h-3 mb-6 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-1000 ${
                  location ? 'bg-gradient-to-r from-green-400 to-emerald-500 w-full animate-gradient-x' : 'bg-gradient-to-r from-yellow-400 to-orange-500 w-1/2'
                }`}
              ></div>
            </div>
            
            {location && (
              <div className="grid grid-cols-2 gap-6 text-white/90">
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <span className="font-semibold text-blue-300">Accuracy:</span>
                  <div className="text-xl font-bold">{location.accuracy?.toFixed(0) || 'N/A'}m</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <span className="font-semibold text-purple-300">Battery:</span>
                  <div className="text-xl font-bold">{typeof location.battery === 'number' ? `${location.battery.toFixed(0)}%` : 'N/A'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Emergency SOS */}
          <button
            onClick={handleSendSOS}
            className="group glass hover:bg-red-500/20 border-2 border-red-400/30 hover:border-red-400/50 text-white font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4"
          >
            <AlertTriangle className="w-8 h-8 text-red-400 group-hover:animate-bounce" />
            <div className="text-left">
              <div className="text-xl">Emergency SOS</div>
              <div className="text-sm opacity-75">Send immediate alert</div>
            </div>
          </button>

          {/* Panic Siren */}
          <button
            onClick={() => togglePanicSiren()}
            className={`group glass border-2 font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 ${
              isSirenActive
                ? 'hover:bg-orange-500/20 border-orange-400/30 hover:border-orange-400/50 text-white'
                : 'hover:bg-orange-500/20 border-orange-400/30 hover:border-orange-400/50 text-white'
            }`}
          >
            {isSirenActive ? <VolumeX className="w-8 h-8 text-orange-400 group-hover:animate-bounce" /> : <Volume2 className="w-8 h-8 text-orange-400 group-hover:animate-bounce" />}
            <div className="text-left">
              <div className="text-xl">{isSirenActive ? 'Stop Beeping' : 'Panic Beeping'}</div>
              <div className="text-sm opacity-75">{isSirenActive ? 'Turn off loud beeps' : 'Loud continuous beeps'}</div>
            </div>
          </button>

          {/* Voice Commands */}
          <button
            onClick={toggleVoiceCommands}
            className={`group glass border-2 font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 ${
              isVoiceEnabled 
                ? 'hover:bg-green-500/20 border-green-400/30 hover:border-green-400/50 text-white' 
                : 'hover:bg-gray-500/20 border-gray-400/30 hover:border-gray-400/50 text-white'
            }`}
          >
            {isVoiceEnabled ? <Mic className="w-8 h-8 text-green-400 group-hover:animate-bounce" /> : <MicOff className="w-8 h-8 text-gray-400" />}
            <div className="text-left">
              <div className="text-xl">Voice Commands</div>
              <div className="text-sm opacity-75">{isVoiceEnabled ? 'Listening...' : 'Enable voice control'}</div>
            </div>
          </button>

          {/* Gesture Controls Status */}
          <div className={`glass border-2 text-white font-bold py-8 px-6 rounded-2xl flex items-center justify-center gap-4 ${
            gesturesEnabled ? 'border-purple-400/30' : 'border-gray-400/30'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              gesturesEnabled ? 'bg-purple-500 animate-pulse' : 'bg-gray-500'
            }`}>
              🤲
            </div>
            <div className="text-left">
              <div className="text-xl">Gesture Controls</div>
              <div className="text-sm opacity-75">{gesturesEnabled ? 'Active' : 'Disabled'}</div>
            </div>
          </div>
        </div>

        {/* Gesture Instructions */}
        {gesturesEnabled && (
          <div className={`glass rounded-xl p-6 mb-8 border border-purple-400/30 bg-purple-500/10 transition-all duration-1000 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              🤲 Gesture Controls Active
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  📳
                </div>
                <span><strong>Shake 3x:</strong> Start Loud Panic Beeping</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                  📳
                </div>
                <span><strong>Shake 4x:</strong> Send SOS Alert</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  👆
                </div>
                <span><strong>Long Press:</strong> Send "I need help!"</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>Note:</strong> Shake gestures must be completed within 3 seconds. Panic beeping will be VERY LOUD and continuous.
              </p>
            </div>
          </div>
        )}

        {/* Safety Status */}
        <div className={`glass rounded-xl p-6 text-center border border-blue-400/30 transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <Shield className="w-8 h-8 text-blue-400 animate-pulse" />
            <div className="text-left">
              <div className="text-xl text-white">Protected & Ready</div>
              <div className="text-sm text-white/75">SafeStep is actively monitoring</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <div className="text-xs text-white/60">{isOnline ? 'Online' : 'Offline'}</div>
            </div>
            <div>
              <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${isVoiceEnabled ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <div className="text-xs text-white/60">Voice</div>
            </div>
            <div>
              <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${gesturesEnabled ? 'bg-purple-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <div className="text-xs text-white/60">Gestures</div>
            </div>
          </div>
          
          <p className="text-white/90 mb-2 text-lg">{voiceStatus}</p>
          <p className="text-white/60 text-sm">
            Say "Jarvis" followed by: "send SOS", "enable panic siren", "I am safe", "coming home", "need pickup"
          </p>
          {isVoiceEnabled && (
            <div className="mt-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
              <p className="text-xs text-green-300">
                <strong>Voice Commands Active:</strong> Emergency commands, panic siren control, and safety messages
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voice Command Tester (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <VoiceCommandTester 
          voiceManager={voiceManagerRef.current} 
          userRole="child" 
        />
      )}

      {/* Floating Chat */}
      <FloatingChat 
        messages={messages}
        currentRole="child"
        onSendMessage={sendQuickMessage}
        childCode={childCode}
        unreadCount={unreadMessages}
        onChatOpen={handleChatOpen}
      />

      {/* Ping Notification */}
      {showPingNotification && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass rounded-3xl shadow-2xl p-8 max-w-sm mx-4 text-center border border-white/30">
            <Bell className="w-20 h-20 mx-auto mb-6 text-blue-400 animate-bounce" />
            <h3 className="text-3xl font-bold text-white mb-3">Parent Ping!</h3>
            <p className="text-white/80 text-lg">Your parent is checking on you</p>
          </div>
        </div>
      )}
    </div>
  );
}