'use client'
/**
 * AnimatedTabPanel — Phase 15 upgrade (15-03).
 *
 * Client wrapper that animates the active tab content using AnimatePresence.
 * Tab navigation uses client-side useRouter().push() from TabBar; this component
 * handles the enter/exit animation of the rendered panel.
 *
 * Animation contract (15-UI-SPEC.md §2 Tab Transition Wipe):
 *   initial:    { opacity: 0, x: 16 }
 *   animate:    { opacity: 1, x: 0 }
 *   exit:       { opacity: 0, x: -16 }
 *   transition: { duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }
 *   mode:       'wait'
 *   key:        tabKey (must change for AnimatePresence to detect swap)
 *
 * Import path: 'framer-motion' (matches package.json — NOT 'motion/react')
 */
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedTabPanelProps {
  tabKey: string
  children: ReactNode
}

export function AnimatedTabPanel({ tabKey, children }: AnimatedTabPanelProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
