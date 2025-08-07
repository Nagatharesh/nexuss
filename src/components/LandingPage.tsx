import React, { useState, useEffect } from 'react';
import { Shield, MapPin, MessageCircle, Bell, Zap, Users, Star, ArrowRight, Play, CheckCircle, Globe, Lock, Smartphone, Heart, Download } from 'lucide-react';
import Logo from './Logo';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Real-Time Location Tracking",
      description: "Track your loved ones with precision GPS technology and get instant location updates.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Bell className="w-8 h-8" />,
      title: "Emergency SOS Alerts",
      description: "One-tap emergency alerts with location sharing for immediate assistance.",
      color: "from-red-500 to-pink-500"
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: "Instant Communication",
      description: "Stay connected with built-in messaging and voice commands.",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Safe Zone Monitoring",
      description: "Set up safe zones and get notified when boundaries are crossed.",
      color: "from-purple-500 to-violet-500"
    }
  ];

  const stats = [
    { number: "99.9%", label: "Uptime Reliability", icon: <Globe className="w-6 h-6" /> },
    { number: "24/7", label: "Emergency Support", icon: <Heart className="w-6 h-6" /> },
    { number: "256-bit", label: "Encryption Security", icon: <Lock className="w-6 h-6" /> },
    { number: "New", label: "Advanced Technology", icon: <Zap className="w-6 h-6" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className={`relative z-10 p-6 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" animate={true} />
          <button
            onClick={onGetStarted}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center gap-2"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center">
          <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 leading-tight">
              Family Safety
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">
                Reimagined
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Advanced real-time tracking, emergency alerts, and communication tools designed to keep your family safe and connected.
            </p>
          </div>

          <div className={`flex flex-col sm:flex-row gap-6 justify-center items-center transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <button
              onClick={onGetStarted}
              className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-3"
            >
              <Play className="w-6 h-6 group-hover:animate-pulse" />
              Start Protecting Your Family
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
            
            {/* Download APK Button */}
            <a
              href="/safestep-app.apk"
              download="SafeStep-Family-Tracker.apk"
              className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-3 relative overflow-hidden"
              onClick={() => {
                // Track download
                console.log('APK download initiated');
                // Show download instructions
                setTimeout(() => {
                  alert('📱 Installation Instructions:\n\n1. Enable "Install from Unknown Sources" in Android settings\n2. Open the downloaded APK file\n3. Grant all permissions for full functionality\n4. Disable battery optimization for SafeStep\n\nThe app will start directly in role selection mode for optimal mobile experience.');
                }, 1000);
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Download className="w-6 h-6 group-hover:animate-bounce" />
              <div className="text-left">
                <div>Download Full App</div>
                <div className="text-sm opacity-90">Android APK - 15MB</div>
              </div>
              <Smartphone className="w-6 h-6 group-hover:animate-pulse" />
            </a>
            
            <div className="flex items-center gap-2 text-gray-300">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full border-2 border-white animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                ))}
              </div>
              <span className="text-sm">Next-generation family safety technology</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className={`mt-32 grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
                <div className="text-white mb-2 flex justify-center group-hover:animate-bounce">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                  {stat.number}
                </div>
                <div className="text-gray-300 text-sm">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 bg-white/5 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-32">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">
              Powerful Features for
              <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Complete Peace of Mind
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Every feature is designed with your family's safety and privacy as the top priority.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Feature Display */}
            <div className="space-y-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-2xl border transition-all duration-500 cursor-pointer transform ${
                    currentFeature === index
                      ? 'bg-white/10 border-white/30 scale-105 shadow-2xl'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                  onClick={() => setCurrentFeature(index)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${feature.color} text-white transform transition-transform ${currentFeature === index ? 'scale-110 animate-pulse' : ''}`}>
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-gray-300">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Visualization */}
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="relative h-80 flex items-center justify-center">
                  {/* Animated Feature Display */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-32 h-32 rounded-full bg-gradient-to-r ${features[currentFeature].color} flex items-center justify-center transform transition-all duration-500 animate-pulse`}>
                      <div className="text-white scale-150">
                        {features[currentFeature].icon}
                      </div>
                    </div>
                  </div>
                  
                  {/* Orbiting Elements */}
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="absolute w-4 h-4 bg-white rounded-full animate-orbit"
                      style={{
                        animationDelay: `${i * 0.5}s`,
                        animationDuration: '4s'
                      }}
                    ></div>
                  ))}
                  
                  {/* Radar Rings */}
                  <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping"></div>
                  <div className="absolute inset-4 border-2 border-white/10 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute inset-8 border-2 border-white/5 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Ready to Protect Your Family?
          </h2>
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
            Experience the future of family safety with cutting-edge technology and real-time protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="group bg-white text-purple-600 px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-4"
            >
              <Shield className="w-8 h-8 group-hover:animate-spin" />
              Get Started Now - It's Free
              <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
            </button>
            
            <a
              href="/safestep-app.apk"
              download="SafeStep-Family-Tracker.apk"
              className="group bg-white/10 backdrop-blur-sm border-2 border-white text-white px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-4 relative overflow-hidden"
              onClick={() => {
                console.log('APK download initiated from CTA');
                setTimeout(() => {
                  alert('📱 SafeStep Mobile App Features:\n\n✅ Background location tracking\n✅ Gesture controls (shake detection)\n✅ Professional emergency sounds\n✅ Offline functionality\n✅ Real-time family communication\n✅ Safe zone monitoring\n\nDownload starting... Please follow installation instructions.');
                }, 500);
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Download className="w-8 h-8 group-hover:animate-bounce" />
              <div className="text-left">
                <div>Download Mobile App</div>
                <div className="text-lg opacity-90">Full Featured APK</div>
              </div>
              <Smartphone className="w-8 h-8 group-hover:animate-pulse" />
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-slate-900 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex justify-center mb-8">
            <Logo size="md" animate={true} />
          </div>
          <div className="text-center text-gray-400">
            <p className="mb-4">© 2025 SafeStep. All rights reserved.</p>
            <p className="text-sm">Keeping families safe with cutting-edge technology and unwavering commitment to privacy.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}