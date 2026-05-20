'use client'
import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const VARIANT_BASE: Record<ButtonVariant, string> = {
  primary:   'bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-md flex items-center gap-2 disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-accent',
  secondary: 'bg-surface border border-border text-sm font-semibold text-zinc-300 rounded-md flex items-center gap-2 hover:text-white hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent',
  ghost:     'border border-border text-sm font-semibold text-zinc-400 rounded-md flex items-center gap-2 hover:text-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-4 min-h-[44px]',
  sm: 'px-3 min-h-[36px] text-xs',
}

function SpinnerSVG() {
  return (
    <svg className="animate-spin h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${VARIANT_BASE[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading && <SpinnerSVG />}
      {children}
    </button>
  )
}
