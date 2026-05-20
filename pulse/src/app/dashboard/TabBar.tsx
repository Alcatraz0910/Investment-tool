'use client'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'

type Tab = { id: string; label: string }

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
}

export function TabBar({ tabs, activeTab }: TabBarProps) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()

  return (
    <nav
      className="flex gap-1 p-1 rounded-full backdrop-blur-xl bg-white/5 border border-white/10"
      style={{ WebkitBackdropFilter: 'blur(24px)' }}
      aria-label="Dashboard tabs"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => router.push(`?tab=${tab.id}`)}
            aria-current={isActive ? 'page' : undefined}
            className="relative px-5 py-2 rounded-full min-h-[36px] flex items-center focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-full bg-accent"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 400, damping: 30 }
                }
              />
            )}
            <span
              className={`relative z-10 text-sm font-semibold ${
                isActive
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200 transition-colors duration-150'
              }`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
