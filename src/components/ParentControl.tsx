import React, { useState, useEffect, useRef } from 'react';
import { ref, set, push, onValue, get } from 'firebase/database';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { database, auth } from '../config/firebase';
import { VoiceCommandManager } from '../utils/voiceCommands';
import { PermissionManager } from '../utils/permissions';
import { showNotification, playNotificationSound, showBrowserNotification } from '../utils/notifications';
import { OfflineManager } from '../utils/offlineManager';
import { EmergencyContactManager } from '../utils/emergencyContacts';
import backgroundService from '../utils/backgroundService';
import { ChildData, ChatMessage, SOSAlert, SafeZone } from '../types';
import { MapPin, Mic, MicOff, Bell, Shield, Users, Zap, ArrowLeft, AlertTriangle, Battery, Wifi, WifiOff, Sparkles, Heart, Globe, Lock } from 'lucide-react';
import MapComponent from './MapComponent';
import FloatingChat from './FloatingChat';
import SOSHistory from './SOSHistory';
import AuthForm from './AuthForm';
import EmergencyContactsManager from './EmergencyContactsManager';
import OfflineIndicator from './OfflineIndicator';
import Logo from './Logo';
import VoiceCommandTester from './VoiceCommandTester';

interface ParentControlProps {
  onBack: () => void;
}

export default function ParentControl({ onBack }: ParentControlProps) {
  const [user, setUser] = useState<User | null>(null);
  const [childCode, setChildCode] = useState('');
  const [childName, setChildName] = useState('');
  const [isTrackingChild, setIsTrackingChild] = useState(false);
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [activeSosAlert, setActiveSosAlert] = useState<string | null>(null);
  const [acknowledgedSosAlerts, setAcknowledgedSosAlerts] = useState<Set<string>>(new Set());
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('Voice commands disabled');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showLocationLostAlert, setShowLocationLostAlert] = useState(false);
  const [isChildOnline, setIsChildOnline] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [showLocationHistory, setShowLocationHistory] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [showVoiceTester, setShowVoiceTester] = useState(false);
  
  const voiceManagerRef = useRef<VoiceCommandManager | null>(null);
  const offlineManagerRef = useRef<OfflineManager>(OfflineManager.getInstance());
  const emergencyManagerRef = useRef<EmergencyContactManager>(EmergencyContactManager.getInstance());
  const locationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const backgroundIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsVisible(true);
    initializePermissions();
    setupAuthListener();
    setupVoiceCommands();
    setupOfflineManager();
    startBackgroundService();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isTrackingChild && childCode) {
      setupChildDataListener();
      setupChatListener();
      setupSOSListener();
      setupLocationHistoryListener();
      startLocationLostCheck();
    } else {
      cleanup();
    }
  }, [isTrackingChild, childCode]);

  const initializePermissions = async () => {
    try {
      await PermissionManager.requestNotificationPermission();
      await PermissionManager.requestMicrophonePermission();
      await PermissionManager.initializeAudioContext();
      
      const testAudio = () => {
        playNotificationSound('ping').catch(e => 
          '/Screenshot 2025-07-11 193952 copy.png'
        );
        document.removeEventListener('click', testAudio);
      };
      document.addEventListener('click', testAudio, { once: true });
    } catch (error) {
      console.error('Permission initialization failed:', error);
    }
  };

  const setupAuthListener = () => {
    onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const snapshot = await get(ref(database, `parents/${user.uid}/trackingChildCode`));
        const storedChildCode = snapshot.val();
        if (storedChildCode) {
          setChildCode(storedChildCode);
          setIsTrackingChild(true);
          showNotification(`Automatically tracking child code: ${storedChildCode}`, 'info');
        }
      }
    });
  };

  const setupVoiceCommands = () => {
    const voiceManager = new VoiceCommandManager(setVoiceStatus);
    
    voiceManager.setCommandHandlers({
      // Child location commands
      'where is my child': handleWhereIsChild,
      
      // Battery status commands
      'child battery': handleChildBattery,
      
      // Communication commands
      'are you okay': () => sendQuickMessage('Are you okay?'),
      'on my way': () => sendQuickMessage('On my way.'),
      'call me': () => sendQuickMessage('Call me when you see this.'),
      
      // Ping command
      'ping child': sendPing
    });
    
    voiceManagerRef.current = voiceManager;
  };

  const setupOfflineManager = () => {
    const offlineManager = offlineManagerRef.current;
    
    offlineManager.onConnectionChange((isOnline) => {
      setIsOffline(!isOnline);
      if (isOnline) {
        showNotification('🌐 Connection restored - syncing data...', 'success');
      } else {
        showNotification('📴 Working offline - limited functionality', 'warning');
      }
    });
  };

  const setupChildDataListener = () => {
    const childRef = ref(database, `children/${childCode}`);
    onValue(childRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setChildData(data);
        setIsChildOnline(data.status === 'online');
        const childName = data.childName || 'Your Child';
        setChildName(childName);
        document.title = `SafeStep - Tracking ${childName}`;
      } else {
        setIsChildOnline(false);
      }
    });
  };

  const setupChatListener = () => {
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
          const childMessages = newMessages.filter(message => message.sender === 'child');
          
          if (childMessages.length > 0) {
            setUnreadMessages(prev => prev + childMessages.length);
            playNotificationSound('message');
            showNotification('💬 New message from child!', 'info');
            showBrowserNotification(
              'New message from child',
              childMessages[childMessages.length - 1].text,
              '/Screenshot 2025-07-11 193952 copy.png'
            );
          }
        }
        
        lastMessageCountRef.current = currentMessageCount;
        setMessages(messageList);
      }
    });
  };

  const setupLocationHistoryListener = () => {
    const historyRef = ref(database, `children/${childCode}/locationHistory`);
    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const historyList = Object.values(data) as Location[];
        historyList.sort((a, b) => b.timestamp - a.timestamp);
        setLocationHistory(historyList.slice(0, 50)); // Keep last 50 locations
      }
    });
  };

  const startBackgroundService = async () => {
    try {
      // Start background service for parent monitoring
      const started = await backgroundService.start();
      if (started) {
        console.log('✅ Background service started for parent control');
      }
    } catch (error) {
      console.error('Failed to start background service:', error);
    }
  };

  const setupSOSListener = () => {
    const sosRef = ref(database, 'sosAlerts');
    onValue(sosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const alertList = Object.entries(data)
          .filter(([_, alert]: [string, any]) => alert.childCode === childCode)
          .map(([key, alert]: [string, any]) => ({ ...alert, id: key })) as (SOSAlert & { id: string })[];
        
        alertList.sort((a, b) => b.timestamp - a.timestamp);
        
        const activeAlert = alertList.find(alert => 
          alert.status === 'active' && !acknowledgedSosAlerts.has(alert.id)
        );
        
        if (activeAlert && activeSosAlert !== activeAlert.id) {
          setActiveSosAlert(activeAlert.id);
          playNotificationSound('sos');
          showBrowserNotification(
            '🚨 SOS ALERT!',
            'Your child needs help!',
            '/Screenshot 2025-07-11 193952 copy.png'
          );
        } else if (!activeAlert) {
          setActiveSosAlert(null);
        }
        
        setSosAlerts(alertList);
      }
    });
  };

  const startLocationLostCheck = () => {
    if (locationCheckIntervalRef.current) {
      clearInterval(locationCheckIntervalRef.current);
    }

    locationCheckIntervalRef.current = setInterval(async () => {
      if (!childCode) return;

      try {
        const snapshot = await get(ref(database, `children/${childCode}/lastSeen`));
        const lastSeen = snapshot.val();
        
        if (lastSeen) {
          const timeDifference = Date.now() - lastSeen;
          const threshold = 5 * 60 * 1000;
          
          if (timeDifference > threshold && !showLocationLostAlert) {
            setShowLocationLostAlert(true);
            playNotificationSound('alert');
            showBrowserNotification(
              '⚠️ Location Lost',
              'No updates received from child',
              '/logo.svg'
            );
          } else if (timeDifference <= threshold && showLocationLostAlert) {
            setShowLocationLostAlert(false);
          }
        }
      } catch (error) {
        console.error('Error checking location status:', error);
      }
    }, 10000);
  };

  const handleLogin = async (email: string, password: string, isSignUp: boolean) => {
    setIsConnecting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification('✅ Account created successfully!', 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('✅ Welcome back to SafeStep!', 'success');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('user-not-found')) {
        showNotification('❌ No account found with this email. Please create an account.', 'error');
      } else if (errorMessage.includes('wrong-password')) {
        showNotification('❌ Incorrect password. Please try again.', 'error');
      } else if (errorMessage.includes('email-already-in-use')) {
        showNotification('❌ An account with this email already exists. Please sign in.', 'error');
      } else if (errorMessage.includes('weak-password')) {
        showNotification('❌ Password should be at least 6 characters long.', 'error');
      } else if (errorMessage.includes('invalid-email')) {
        showNotification('❌ Please enter a valid email address.', 'error');
      } else {
        showNotification('❌ Authentication failed: ' + errorMessage, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTrackChild = async () => {
    if (!childCode || childCode.length !== 4) {
      showNotification('Please enter a valid 4-digit code', 'warning');
      return;
    }

    setIsConnecting(true);
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );
      
      const dataPromise = get(ref(database, `children/${childCode}`));
      const snapshot = await Promise.race([dataPromise, timeoutPromise]) as any;
      const childData = snapshot.val();
      
      if (childData && childData.isActive && childData.status === 'online') {
        if (user) {
          await set(ref(database, `parents/${user.uid}/trackingChildCode`), childCode);
        }
        
        if (childName.trim()) {
          await set(ref(database, `children/${childCode}/childName`), childName.trim());
        }
        
        setIsTrackingChild(true);
        showNotification(`✅ Successfully connected to ${childName || 'child'}!`, 'success');
        playNotificationSound('message');
      } else if (childData && childData.status === 'offline') {
        showNotification('❌ Child device is offline. Please ensure the child app is running and has internet connection.', 'error');
      } else {
        showNotification('❌ Child code not found or child is not active. Please ensure the child app is running with the correct code.', 'error');
      }
    } catch (error) {
      console.error('Error tracking child:', error);
      if ((error as Error).message === 'Connection timeout') {
        showNotification('❌ Connection timeout. Please check your internet connection and try again.', 'error');
      } else {
        showNotification('❌ Error connecting to child: ' + (error as Error).message, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const sendPing = async () => {
    if (!childCode) {
      showNotification('No child is currently being tracked', 'warning');
      return;
    }
    
    try {
      await set(ref(database, `children/${childCode}/ping`), {
        timestamp: Date.now()
      });
      showNotification('📡 Ping sent to child!', 'success');
      playNotificationSound('ping');
    } catch (error) {
      console.error('Failed to send ping:', error);
      showNotification('Failed to send ping: ' + (error as Error).message, 'error');
    }
  };

  const sendQuickMessage = async (message: string) => {
    const offlineManager = offlineManagerRef.current;
    const messageData = {
      sender: 'parent' as const,
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

  const handleWhereIsChild = async () => {
    try {
      if (!childCode) {
        const responseText = 'No child is currently being tracked. Please connect to a child device first.';
        showNotification(responseText, 'warning');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
        }
        return;
      }
      
      const snapshot = await get(ref(database, `children/${childCode}/lastLocation`));
      const location = snapshot.val();
      
      if (location && location.lat && location.lng) {
        const timeDiff = Date.now() - location.timestamp;
        const minutesAgo = Math.floor(timeDiff / 60000);
        const timeText = minutesAgo < 1 ? 'just now' : 
                        minutesAgo === 1 ? '1 minute ago' : 
                        `${minutesAgo} minutes ago`;
        
        const responseText = `Your child's location was last updated ${timeText}. ` +
          `The accuracy is ${location.accuracy?.toFixed(0) || 'unknown'} meters. ` +
          `Battery level is ${typeof location.battery === 'number' ? location.battery.toFixed(0) + ' percent' : 'unknown'}.`;
        
        showNotification(responseText, 'info');
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(responseText);
          window.speechSynthesis.speak(utterance);
        }
      } else {
        const responseText = `Child location data is not available. The child device may be offline or location services may be disabled.`;
        showNotification(responseText, 'warning');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
        }
      }
    } catch (error) {
      console.error('Error fetching child location:', error);
      const responseText = 'Unable to retrieve child location due to a connection error. Please check your internet connection and try again.';
      showNotification(responseText, 'error');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
      }
    }
  };

  const handleChildBattery = async () => {
    try {
      if (!childCode) {
        const responseText = 'No child is currently being tracked. Please connect to a child device first.';
        showNotification(responseText, 'warning');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
        }
        return;
      }
      
      const snapshot = await get(ref(database, `children/${childCode}/lastLocation`));
      const locationData = snapshot.val();
      const battery = locationData?.battery;
      
      const responseText = typeof battery === 'number' 
        ? `Your child's device battery is at ${battery.toFixed(0)} percent.`
        : 'Battery information is not available. The child device may be offline or battery reporting may be disabled.';
      
      showNotification(responseText, 'info');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
      }
    } catch (error) {
      console.error('Error fetching battery info:', error);
      const responseText = 'Unable to retrieve battery information due to a connection error. Please check your internet connection and try again.';
      showNotification(responseText, 'error');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(responseText));
      }
    }
  };

  const toggleVoiceCommands = async () => {
    if (voiceManagerRef.current) {
      const enabled = await voiceManagerRef.current.toggle();
      setIsVoiceEnabled(enabled);
    }
  };

  const acknowledgeSOS = async () => {
    if (activeSosAlert) {
      try {
        // Add to acknowledged alerts to prevent re-showing
        setAcknowledgedSosAlerts(prev => new Set([...prev, activeSosAlert]));
        
        // Update status in database
        await set(ref(database, `sosAlerts/${activeSosAlert}/status`), 'resolved');
        
        // Clear the active alert
        setActiveSosAlert(null);
        
        showNotification('SOS alert acknowledged', 'info');
      } catch (error) {
        console.error('Error acknowledging SOS:', error);
        showNotification('Error acknowledging SOS', 'error');
      }
    }
  };

  const acknowledgeLocationLost = () => {
    showNotification('Location lost alert acknowledged', 'info');
    setShowLocationLostAlert(false);
  };

  const cleanup = () => {
    if (locationCheckIntervalRef.current) {
      clearInterval(locationCheckIntervalRef.current);
      locationCheckIntervalRef.current = null;
    }
    
    // Stop background service safely
    try {
      backgroundService.stop();
    } catch (error) {
      console.warn('Error stopping background service:', error);
    }
    
    if (voiceManagerRef.current) {
      try {
        voiceManagerRef.current.disable();
      } catch (error) {
        console.warn('Error disabling voice commands:', error);
      }
    }
    
    // Release wake lock if active
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (error) {
        console.warn('Error releasing wake lock:', error);
      }
    }
  };

  const handleChatOpen = () => {
    setUnreadMessages(0);
  };

  if (!user) {
    return <AuthForm onSubmit={handleLogin} isLoading={isConnecting} />;
  }

  if (!isTrackingChild) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
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
              <h1 className="text-lg font-semibold text-white">Parent Control</h1>
            </div>
            
            <div className="w-10"></div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-20 pb-16">
          <div className="text-center mb-16">
            <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Family Safety
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">
                  Control Center
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                Connect to your child's device and monitor their safety with real-time tracking and communication.
              </p>
            </div>
          </div>

          {/* Connection Form */}
          <div className={`max-w-md mx-auto transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="glass rounded-3xl p-8 border border-white/20 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                  Connect to Child
                </h2>
                <p className="text-white/80 text-lg">Enter your child's tracking code to begin monitoring</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Child Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 4-digit code"
                    value={childCode}
                    onChange={(e) => setChildCode(e.target.value)}
                    maxLength={4}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Child's Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter child's name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm"
                  />
                </div>
                
                <button
                  onClick={handleTrackChild}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <div className="spinner"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6" />
                      Connect to Child
                    </>
                  )}
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-white/60 text-sm">
                  Make sure your child's SafeStep app is running
                </p>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className={`mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="glass rounded-2xl p-6 border border-white/20 text-center hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Real-Time Tracking</h3>
              <p className="text-white/70">Monitor your child's location with precision GPS technology</p>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/20 text-center hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Emergency Alerts</h3>
              <p className="text-white/70">Receive instant SOS alerts when your child needs help</p>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/20 text-center hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Safe Zones</h3>
              <p className="text-white/70">Set up safe areas and get notified when boundaries are crossed</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Alert Banners */}
      {activeSosAlert && !acknowledgedSosAlerts.has(activeSosAlert) && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-4 text-center z-50 shadow-2xl border-b border-red-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
            <p className="text-lg font-bold">🚨 EMERGENCY SOS ALERT! 🚨</p>
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>
          <p className="mb-3">Your child needs immediate help!</p>
          <button
            onClick={acknowledgeSOS}
            className="bg-white text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors transform hover:scale-105"
          >
            Acknowledge Alert
          </button>
        </div>
      )}

      {showLocationLostAlert && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4 text-center z-40 shadow-xl border-b border-orange-500">
          <p className="font-semibold">⚠️ CHILD LOCATION LOST! No updates received! ⚠️</p>
          <button
            onClick={acknowledgeLocationLost}
            className="mt-2 bg-white text-orange-600 px-4 py-1 rounded-lg font-semibold hover:bg-gray-100 transition-colors transform hover:scale-105"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`relative z-10 bg-white/10 backdrop-blur-sm border-b border-white/20 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-110"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} animate={true} />
            <div className="text-center">
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Tracking: {childName || 'Child'}
              </h1>
              <div className="flex items-center gap-2 text-sm">
                {isChildOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                <span className="text-white/80">Code: {childCode}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isChildOnline ? 'bg-green-500/20 text-green-300 border border-green-400/30' : 'bg-red-500/20 text-red-300 border border-red-400/30'
                }`}>
                  {isChildOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Hero Stats Section */}
        <div className={`text-center mb-8 transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Family Safety
            <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">
              Dashboard
            </span>
          </h2>
          <p className="text-lg text-gray-300 mb-8">Real-time monitoring and protection for your loved ones</p>
        </div>

        {/* Status Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Connection Status */}
          <div className="glass rounded-xl p-6 border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              {isChildOnline ? <Wifi className="w-8 h-8 text-green-400 animate-pulse" /> : <WifiOff className="w-8 h-8 text-red-400" />}
              <div>
                <p className="text-sm text-white/70">Connection</p>
                <p className={`font-bold text-lg ${isChildOnline ? 'text-green-400' : 'text-red-400'}`}>
                  {isChildOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all duration-1000 ${
                isChildOnline ? 'bg-gradient-to-r from-green-400 to-emerald-500 w-full' : 'bg-gradient-to-r from-red-400 to-red-500 w-1/4'
              }`}></div>
            </div>
          </div>

          {/* Battery Status */}
          <div className="glass rounded-xl p-6 border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <Battery className={`w-8 h-8 ${
                typeof childData?.lastLocation?.battery === 'number' 
                  ? childData.lastLocation.battery > 20 ? 'text-green-400' : 'text-red-400'
                  : 'text-gray-400'
              }`} />
              <div>
                <p className="text-sm text-white/70">Battery</p>
                <p className="font-bold text-lg text-white">
                  {typeof childData?.lastLocation?.battery === 'number' 
                    ? `${childData.lastLocation.battery.toFixed(0)}%` 
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-1000"
                style={{ 
                  width: `${typeof childData?.lastLocation?.battery === 'number' ? childData.lastLocation.battery : 0}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Location Accuracy */}
          <div className="glass rounded-xl p-6 border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-8 h-8 text-blue-400 animate-pulse" />
              <div>
                <p className="text-sm text-white/70">Accuracy</p>
                <p className="font-bold text-lg text-white">
                  {childData?.lastLocation?.accuracy ? `${childData.lastLocation.accuracy.toFixed(0)}m` : 'N/A'}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 w-3/4 transition-all duration-1000"></div>
            </div>
          </div>

          {/* Last Update */}
          <div className="glass rounded-xl p-6 border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
              <div>
                <p className="text-sm text-white/70">Last Update</p>
                <p className="font-bold text-lg text-white">
                  {childData?.lastLocation ? new Date(childData.lastLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 w-full animate-gradient-x"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <button
            onClick={sendPing}
            className="group glass hover:bg-blue-500/20 border-2 border-blue-400/30 hover:border-blue-400/50 text-white font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <Bell className="w-8 h-8 text-blue-400 group-hover:animate-bounce relative z-10" />
            <div className="text-left relative z-10">
              <div className="text-xl">Ping Child</div>
              <div className="text-sm opacity-75">Send notification</div>
            </div>
            <Sparkles className="w-6 h-6 text-blue-300 group-hover:animate-pulse relative z-10" />
          </button>
          
          <button
            onClick={toggleVoiceCommands}
            className={`group glass border-2 font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden ${
              isVoiceEnabled 
                ? 'hover:bg-green-500/20 border-green-400/30 hover:border-green-400/50 text-white' 
                : 'hover:bg-gray-500/20 border-gray-400/30 hover:border-gray-400/50 text-white'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            {isVoiceEnabled ? <Mic className="w-8 h-8 text-green-400 group-hover:animate-bounce relative z-10" /> : <MicOff className="w-8 h-8 text-gray-400 relative z-10" />}
            <div className="text-left relative z-10">
              <div className="text-xl">Voice Commands</div>
              <div className="text-sm opacity-75">{isVoiceEnabled ? 'Listening...' : 'Enable voice'}</div>
            </div>
            <Zap className="w-6 h-6 text-green-300 group-hover:animate-pulse relative z-10" />
          </button>

          <button
            onClick={() => setShowEmergencyContacts(true)}
            className="group glass hover:bg-red-500/20 border-2 border-red-400/30 hover:border-red-400/50 text-white font-bold py-8 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <AlertTriangle className="w-8 h-8 text-red-400 group-hover:animate-bounce relative z-10" />
            <div className="text-left relative z-10">
              <div className="text-xl">Emergency Contacts</div>
              <div className="text-sm opacity-75">Manage alert network</div>
            </div>
            <Shield className="w-6 h-6 text-red-300 group-hover:animate-pulse relative z-10" />
          </button>
        </div>

        {/* Emergency Contacts Modal */}
        {showEmergencyContacts && (
          <EmergencyContactsManager onClose={() => setShowEmergencyContacts(false)} />
        )}

        {/* Additional Status Info */}
        <div className={`glass rounded-xl p-6 mb-8 text-center border border-white/20 transition-all duration-1000 delay-800 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${!isOffline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <div className="text-sm text-white/80">{!isOffline ? 'Online' : 'Offline'}</div>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${isVoiceEnabled ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <div className="text-sm text-white/80">Voice</div>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${isTrackingChild ? 'bg-purple-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <div className="text-sm text-white/80">Tracking</div>
            </div>
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${activeSosAlert ? 'bg-red-400 animate-flash' : 'bg-green-400'}`}></div>
              <div className="text-sm text-white/80">{activeSosAlert && !acknowledgedSosAlerts.has(activeSosAlert) ? 'SOS Active' : 'Safe'}</div>
            </div>
          </div>
        </div>

        {/* Protected Status */}
        <div className={`glass rounded-xl p-6 mb-8 text-center border border-purple-400/30 transition-all duration-1000 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-center gap-4">
            <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
            <div className="text-left">
              <div className="text-xl text-white">Family Protected</div>
              <div className="text-sm text-white/75">SafeStep monitoring active</div>
            </div>
            <Heart className="w-6 h-6 text-purple-300 animate-heartbeat" />
          </div>
        </div>

        {/* Voice Status */}
        <div className={`glass rounded-xl p-6 mb-8 text-center border border-white/20 transition-all duration-1000 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Mic className={`w-6 h-6 ${isVoiceEnabled ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
            <p className="text-white/90 text-lg font-medium">{voiceStatus}</p>
          </div>
          <p className="text-white/60 text-sm">
            Say "Jarvis" followed by: "where is my child", "child battery", "ping child", "are you okay"
          </p>
          {isVoiceEnabled && (
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>Voice Commands Active:</strong> Child location, battery status, communication, and ping
              </p>
            </div>
          )}
        </div>

        {/* Map Component */}
        <div className={`mb-8 transition-all duration-1000 delay-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <MapComponent 
            childData={childData}
            safeZone={safeZone}
            onSafeZoneChange={setSafeZone}
            childCode={childCode}
            locationHistory={locationHistory}
          />
        </div>

        {/* Location History */}
        <div className={`mb-8 transition-all duration-1000 delay-1100 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="glass rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-green-400" />
                Location History
              </h3>
              <button
                onClick={() => setShowLocationHistory(!showLocationHistory)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                {showLocationHistory ? 'Hide' : 'Show'} History
              </button>
            </div>
            
            {showLocationHistory && (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {locationHistory.length === 0 ? (
                  <p className="text-white/60 text-center py-4">No location history available</p>
                ) : (
                  locationHistory.map((location, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/15 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm text-white/90">
                          <strong>Time:</strong> {new Date(location.timestamp).toLocaleString()}
                        </div>
                        <div className="text-xs text-white/70">
                          #{index + 1}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
                        <div>
                          <strong>Coordinates:</strong><br />
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </div>
                        <div>
                          <strong>Accuracy:</strong> {location.accuracy?.toFixed(0) || 'N/A'}m<br />
                          <strong>Battery:</strong> {typeof location.battery === 'number' ? `${location.battery.toFixed(0)}%` : 'N/A'}
                        </div>
                      </div>
                      
                      {(location.speed || location.altitude) && (
                        <div className="mt-2 text-sm text-white/70">
                          {location.speed && <span><strong>Speed:</strong> {(location.speed * 3.6).toFixed(1)} km/h </span>}
                          {location.altitude && <span><strong>Altitude:</strong> {location.altitude.toFixed(0)}m</span>}
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline transition-colors text-sm"
                        >
                          View on Map <MapPin className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* SOS History */}
        <div className={`transition-all duration-1000 delay-1200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <SOSHistory sosAlerts={sosAlerts} />
        </div>
      </div>

      {/* Voice Command Tester (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <VoiceCommandTester 
          voiceManager={voiceManagerRef.current} 
          userRole="parent" 
        />
      )}

      {/* Floating Chat */}
      <FloatingChat 
        messages={messages}
        currentRole="parent"
        onSendMessage={sendQuickMessage}
        childCode={childCode}
        unreadCount={unreadMessages}
        onChatOpen={handleChatOpen}
      />
    </div>
  );
}