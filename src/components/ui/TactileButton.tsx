import React from 'react';
import { Link } from 'react-router';

export type TactileButtonVariant =
  | 'primary'
  | 'secondary'
  | 'marine'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ghost';

export type TactileButtonSize = 'sm' | 'md' | 'lg';

export interface TactileButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TactileButtonVariant;
  size?: TactileButtonSize;
  to?: string;
  href?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_STYLES: Record<TactileButtonVariant, {
  base: string;
  depth: string;
  active: string;
}> = {
  primary: {
    base: 'bg-[#176EA8] text-white hover:bg-[#145D8F]',
    depth: 'border-b-[3px] border-[#0D4971] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  marine: {
    base: 'bg-[#193953] text-white hover:bg-[#122B3F]',
    depth: 'border-b-[3px] border-[#0A1824] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  secondary: {
    base: 'bg-white text-[#193953] border border-[#CBDDE9] hover:bg-[#F4F9FC]',
    depth: 'border-b-[3px] border-b-[#A7C2D6] shadow-xs',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  success: {
    base: 'bg-[#0E8A50] text-white hover:bg-[#0A7040]',
    depth: 'border-b-[3px] border-[#06502D] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  warning: {
    base: 'bg-[#D97706] text-white hover:bg-[#B45309]',
    depth: 'border-b-[3px] border-[#823A03] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  danger: {
    base: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
    depth: 'border-b-[3px] border-[#8A1111] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  ghost: {
    base: 'bg-transparent text-[#193953] hover:bg-[#EAF2F7] border border-transparent',
    depth: 'border-b-[2px] border-b-transparent',
    active: 'active:bg-[#DDE9F2]',
  },
};

const SIZE_STYLES: Record<TactileButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-bold rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm font-bold rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base font-extrabold rounded-2xl gap-2.5',
};

export default function TactileButton({
  variant = 'primary',
  size = 'md',
  to,
  href,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...props
}: TactileButtonProps) {
  const vStyle = VARIANT_STYLES[variant];
  const sStyle = SIZE_STYLES[size];

  const commonClasses = [
    'inline-flex items-center justify-center select-none font-sans',
    'transition-all duration-75 ease-out cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176EA8] focus-visible:ring-offset-2',
    'motion-reduce:transform-none motion-reduce:transition-none',
    vStyle.base,
    vStyle.depth,
    disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : vStyle.active,
    sStyle,
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={commonClasses} role="button">
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} className={commonClasses} role="button">
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={commonClasses}
      disabled={disabled}
      {...props}
    >
      {content}
    </button>
  );
}
