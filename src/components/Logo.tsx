import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

export default function Logo({ size = 'md', className = '', showText = true, animate = false }: LogoProps) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-lg' },
    md: { container: 'w-12 h-12', text: 'text-2xl' },
    lg: { container: 'w-16 h-16', text: 'text-3xl' },
    xl: { container: 'w-24 h-24', text: 'text-4xl' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative ${animate ? 'animate-pulse' : ''}`}>
        {/* Circular container with glow effect */}
        <div className={`${currentSize.container} rounded-full overflow-hidden border-2 border-white/20 shadow-lg relative`}>
          <img
            src="/Screenshot 2025-07-11 193952 copy.png"
            alt="SafeStep Logo"
            className="w-full h-full object-cover"
          />
          
          {/* Overlay gradient for better integration */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 rounded-full"></div>
        </div>
        
        {/* Animated glow ring */}
        {animate && (
          <>
            <div className={`absolute inset-0 ${currentSize.container} rounded-full bg-gradient-to-r from-blue-400 to-purple-400 blur-md opacity-30 animate-ping`}></div>
            <div className={`absolute inset-0 ${currentSize.container} rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-lg opacity-20 animate-pulse`}></div>
          </>
        )}
        
        {/* Hover glow effect */}
        <div className={`absolute inset-0 ${currentSize.container} rounded-full bg-gradient-to-r from-blue-400/0 to-purple-400/0 hover:from-blue-400/20 hover:to-purple-400/20 transition-all duration-300`}></div>
      </div>
      
      {showText && (
        <h1 className={`${currentSize.text} font-bold text-white drop-shadow-lg ${animate ? 'animate-fade-in' : ''}`}>
          SafeStep
        </h1>
      )}
    </div>
  );
}