'use client'
/**
 * AnimatedTabPanel — Phase 6 (D-11.2, D-12).
 *
 * Client wrapper that fades in the active tab content using AnimatePresence.
 * Tab navigation stays server-side URL links; this component only handles
 * the enter animation of the rendered panel.
 *
 * Animation contract (06-UI-SPEC.md):
 *   initial:    { opacity: 0, y: 8 }
 *   animate:    { opacity: 1, y: 0 }
 *   exit:       { opacity: 0, y: -8 }
 *   transition: { duration: 0.2, ease: 'easeOut' }
 *   mode:       'wait'
 *   key:        tabKey (must change for AnimatePresence to detect swap)
 *
 * Import path: 'framer-motion' (matches package.json — NOT 'motion/react')
 */
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedTabPanelProps {
  tabKey: string
  children: ReactNode
}

export function AnimatedTabPanel({ tabKey, children }: AnimatedTabPanelProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
