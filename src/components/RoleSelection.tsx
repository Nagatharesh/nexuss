import React from 'react';
import { Shield, Users, ArrowLeft, Zap, Heart } from 'lucide-react';
import Logo from './Logo';

interface RoleSelectionProps {
  onSelectRole: (role: 'child' | 'parent') => void;
  onBack: () => void;
}

export default function RoleSelection({ onSelectRole, onBack }: RoleSelectionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/20 transition-all duration-300 transform hover:scale-110 z-10"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md w-full border border-white/20 animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" animate={true} />
          </div>
          <p className="text-gray-300 text-lg">Choose your role to get started</p>
        </div>
        
        <div className="space-y-6">
          <button
            onClick={() => onSelectRole('child')}
            className="group w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-6 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 animate-slide-up relative overflow-hidden"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <Shield className="w-8 h-8 group-hover:animate-bounce relative z-10" />
            <div className="text-left relative z-10">
              <div className="text-xl">Child Tracker</div>
              <div className="text-sm opacity-90">Stay safe and connected</div>
            </div>
            <Zap className="w-6 h-6 group-hover:animate-pulse relative z-10" />
          </button>
          
          <button
            onClick={() => onSelectRole('parent')}
            className="group w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-4 animate-slide-up relative overflow-hidden"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <Users className="w-8 h-8 group-hover:animate-bounce relative z-10" />
            <div className="text-left relative z-10">
              <div className="text-xl">Parent Control</div>
              <div className="text-sm opacity-90">Monitor and protect</div>
            </div>
            <Heart className="w-6 h-6 group-hover:animate-pulse relative z-10" />
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm animate-fade-in" style={{ animationDelay: '0.9s' }}>
            Secure • Private • Reliable
          </p>
        </div>
      </div>
    </div>
  );
}