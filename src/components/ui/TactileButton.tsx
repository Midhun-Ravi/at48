import React from 'react';
import { Link } from 'react-router';

export type TactileButtonVariant =
  | 'primary'
  | 'secondary'
  | 'forest'
  | 'marine'
  | 'sage'
  | 'terracotta'
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

const VARIANT_STYLES: Record<string, {
  base: string;
  depth: string;
  active: string;
}> = {
  primary: {
    base: 'bg-[#C65B32] text-white hover:bg-[#B04E27]',
    depth: 'border-b-[3px] border-[#8D3817] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  terracotta: {
    base: 'bg-[#C65B32] text-white hover:bg-[#B04E27]',
    depth: 'border-b-[3px] border-[#8D3817] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  forest: {
    base: 'bg-[#344F48] text-white hover:bg-[#273D37]',
    depth: 'border-b-[3px] border-[#1A2A26] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  marine: {
    // Aliased to forest for warm palette consistency
    base: 'bg-[#344F48] text-white hover:bg-[#273D37]',
    depth: 'border-b-[3px] border-[#1A2A26] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  secondary: {
    base: 'bg-white text-[#344F48] border border-[#EADBCE] hover:bg-[#FFF7F0]',
    depth: 'border-b-[3px] border-b-[#CFBCAC] shadow-xs',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  sage: {
    base: 'bg-[#5F7B6B] text-white hover:bg-[#4E6759]',
    depth: 'border-b-[3px] border-[#394C41] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  success: {
    base: 'bg-[#3D694E] text-white hover:bg-[#30553E]',
    depth: 'border-b-[3px] border-[#203D2A] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  warning: {
    base: 'bg-[#D97706] text-white hover:bg-[#B45309]',
    depth: 'border-b-[3px] border-[#823A03] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  danger: {
    base: 'bg-[#C64032] text-white hover:bg-[#A83226]',
    depth: 'border-b-[3px] border-[#782017] shadow-sm',
    active: 'active:translate-y-[2px] active:border-b-[1px]',
  },
  ghost: {
    base: 'bg-transparent text-[#344F48] hover:bg-[#F8E1D2]/50 border border-transparent',
    depth: 'border-b-[2px] border-b-transparent',
    active: 'active:bg-[#F2D6C3]',
  },
};

const SIZE_STYLES: Record<TactileButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-bold rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm font-bold rounded-xl gap-2',
  lg: 'px-6 py-3 text-base font-extrabold rounded-xl gap-2.5',
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
  const vStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const sStyle = SIZE_STYLES[size];

  const commonClasses = [
    'inline-flex items-center justify-center select-none font-sans',
    'transition-all duration-75 ease-out cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C65B32] focus-visible:ring-offset-2',
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
