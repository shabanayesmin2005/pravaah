import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const variantStyles = {
    critical: 'bg-red-950/80 text-red-300 border-red-700/60',
    high: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    medium: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/60',
    low: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
    info: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    neutral: 'bg-gray-800 text-gray-300 border-gray-700',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
};
