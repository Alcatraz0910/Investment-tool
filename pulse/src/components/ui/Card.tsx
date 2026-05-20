import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const padClass = padding === 'sm' ? 'p-3' : 'p-4'
  return (
    <div
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl ${padClass} ${className}`}
    >
      {children}
    </div>
  )
}
