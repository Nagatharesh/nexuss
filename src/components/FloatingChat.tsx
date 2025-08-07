import React, { useState, useRef, useEffect } from 'react';
import { ref, push } from 'firebase/database';
import { database } from '../config/firebase';
import { ChatMessage } from '../types';
import { Send, MessageCircle, X, Minimize2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { showNotification, playNotificationSound } from '../utils/notifications';
import { PermissionManager } from '../utils/permissions';

interface FloatingChatProps {
  messages: ChatMessage[];
  currentRole: 'child' | 'parent';
  onSendMessage: (message: string) => void;
  childCode: string;
  unreadCount?: number;
  onChatOpen?: () => void;
}

export default function FloatingChat({ 
  messages, 
  currentRole, 
  onSendMessage, 
  childCode, 
  unreadCount = 0,
  onChatOpen 
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const quickMessages = currentRole === 'child' 
    ? ['I am safe!', 'Coming home.', 'Need to be picked up.']
    : ['Are you okay?', 'On my way.', 'Call me when you see this.'];

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      onChatOpen?.();
    }
  }, [messages, isOpen, onChatOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendCustomMessage = async () => {
    if (!customMessage.trim()) {
      showNotification('Message cannot be empty', 'warning');
      return;
    }

    try {
      const messageData = {
        sender: currentRole,
        text: customMessage.trim(),
        timestamp: Date.now(),
        type: 'text'
      };
      
      await push(ref(database, `chats/${childCode}/messages`), messageData);
      setCustomMessage('');
      showNotification('Message sent!', 'success');
      playNotificationSound('message');
    } catch (error) {
      console.error('Failed to send message:', error);
      showNotification('Failed to send message: ' + (error as Error).message, 'error');
    }
  };

  const startVoiceRecording = async () => {
    if (!PermissionManager.isMicrophonePermissionGranted()) {
      const granted = await PermissionManager.requestMicrophonePermission();
      if (!granted) {
        showNotification('Microphone permission required for voice messages', 'error');
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Check supported MIME types
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        await sendVoiceMessage(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) { // Max 60 seconds
            stopVoiceRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      showNotification('🎤 Recording voice message...', 'info');
    } catch (error) {
      console.error('Failed to start recording:', error);
      showNotification('Failed to start recording: ' + (error as Error).message, 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        const messageData = {
          sender: currentRole,
          text: '🎤 Voice message',
          timestamp: Date.now(),
          type: 'voice',
          audioData: base64Audio,
          duration: recordingTime
        };
        
        await push(ref(database, `chats/${childCode}/messages`), messageData);
        showNotification('Voice message sent!', 'success');
        playNotificationSound('message');
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Failed to send voice message:', error);
      showNotification('Failed to send voice message: ' + (error as Error).message, 'error');
    }
  };

  const playVoiceMessage = async (audioData: string) => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);
      const audio = new Audio(audioData);
      
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        showNotification('Failed to play voice message', 'error');
      };
      
      await audio.play();
    } catch (error) {
      setIsPlaying(false);
      console.error('Failed to play voice message:', error);
      showNotification('Failed to play voice message', 'error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCustomMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    onChatOpen?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            onClick={handleOpen}
            className="relative glass hover:bg-white/20 text-white w-16 h-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center border border-white/30 hover:border-white/50"
          >
            <MessageCircle className="w-7 h-7" />
            {unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-96 glass rounded-3xl shadow-2xl border border-white/30 z-50 flex flex-col overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-4 py-3 border-b border-white/20 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Messages</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-white/60 text-center text-sm">No messages yet</p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.sender === currentRole ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm backdrop-blur-sm ${
                      message.sender === currentRole
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'bg-white/20 text-white border border-white/30'
                    }`}
                  >
                    {(message as any).type === 'voice' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => playVoiceMessage((message as any).audioData)}
                          disabled={isPlaying}
                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                        >
                          {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          <span>{formatDuration((message as any).duration || 0)}</span>
                        </button>
                      </div>
                    ) : (
                      <div>{message.text}</div>
                    )}
                    <div className={`text-xs mt-1 ${
                      message.sender === currentRole ? 'text-white/70' : 'text-white/50'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Messages */}
          <div className="px-4 py-2 border-t border-white/20">
            <div className="flex flex-wrap gap-1 mb-2">
              {quickMessages.map((message, index) => (
                <button
                  key={index}
                  onClick={() => onSendMessage(message)}
                  className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-full text-xs transition-colors border border-white/20 hover:border-white/30"
                >
                  {message}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/20">
            {isRecording ? (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl p-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm">Recording... {formatDuration(recordingTime)}</span>
                </div>
                <button
                  onClick={stopVoiceRecording}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                >
                  Stop
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50 text-sm backdrop-blur-sm"
                />
                <button
                  onClick={startVoiceRecording}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-3 py-2 rounded-xl transition-colors flex items-center justify-center"
                  title="Record voice message"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSendCustomMessage}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-3 py-2 rounded-xl transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}