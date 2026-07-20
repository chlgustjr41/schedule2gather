import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuthStore } from '@/stores/authStore'
import { useAutoLogoff } from '@/hooks/useAutoLogoff'
import LandingPage from '@/pages/LandingPage'
import CreatePage from '@/pages/CreatePage'
import EventPage from '@/pages/EventPage'
import DashboardPage from '@/pages/DashboardPage'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/new" element={<CreatePage />} />
        <Route path="/e/:slug" element={<EventPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </motion.div>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  useAutoLogoff()

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}
