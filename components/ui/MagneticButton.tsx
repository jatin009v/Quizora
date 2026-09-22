'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  magneticStrength?: number;
}

export function MagneticButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  magneticStrength = 0.3,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(btn, {
        x: x * magneticStrength,
        y: y * magneticStrength,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
      });
    };

    btn.addEventListener('mousemove', handleMouseMove);
    btn.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      btn.removeEventListener('mousemove', handleMouseMove);
      btn.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [magneticStrength]);

  const baseStyles =
    'relative inline-flex items-center justify-center font-display font-bold uppercase tracking-wider transition-colors focus:outline-none cursor-pointer border-2 border-brand-black shadow-editorial active:translate-x-1 active:translate-y-1 active:shadow-none';

  const variantStyles = {
    primary: 'bg-burnt-orange text-white hover:bg-burnt-orange-hover',
    secondary: 'bg-vibrant-pink text-white hover:bg-vibrant-pink-hover',
    accent: 'bg-deep-blue text-white hover:bg-deep-blue-dark',
    outline: 'bg-warm-beige text-brand-black hover:bg-warm-beige-dark',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-xs rounded-md',
    md: 'px-6 py-3 text-sm rounded-lg',
    lg: 'px-8 py-4 text-base rounded-xl',
  };

  return (
    <button
      ref={buttonRef}
      className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
      {...props}
    >
      {children}
    </button>
  );
}
