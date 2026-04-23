
import React from 'react';

interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
}

export const LiquidGlass: React.FC<LiquidGlassProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
            {children}
        </div>
    </div>
  );
};
