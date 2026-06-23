import { useState, useEffect, useCallback } from 'react'
import OccupancyCounter from './components/OccupancyCounter'
import AlertBanner      from './components/AlertBanner'
import StatsPanel       from './components/StatsPanel'
import HistoryTable     from './components/HistoryTable'
import HistoryChart     from './components/HistoryChart'
import PredictionChart  from './components/PredictionChart'
import AdminLogin       from './components/AdminLogin'
import AdminPanel       from './components/AdminPanel'
import { useWebSocket } from './hooks/useWebSocket'
import { useAuth }      from './hooks/useAuth'

const API_URL          = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CAPACITY_DEFAULT = parseInt(import.meta.env.VITE_CAPACITY || '50', 10)

// Vues possibles : "public" | "login" | "admin"
export default function App() {
  const [view,      setView]      = useState('public')
  const { isAdmin, loading: authLoading, error: authError, login, logout, authFetch } = useAuth()

  const [occupation,        setOccupation]        = useState(null)
  const [capacity,          setCapacity]          = useState(CAPACITY_DEFAULT)
  const [thresholdWarning,  setThresholdWarning]  = useState(70)
  const [thresholdCritical, setThresholdCritical] = useState(90)
  const [history,           setHistory]           = useState([])
  const [peakSoon,          setPeakSoon]          = useState(false)
  const [peakRate,          setPeakRate]          = useState(null)
  const [peakHour,          setPeakHour]          = useState(null)

  const rate   = capacity > 0 && occupation != null
    ? Math.round(occupation / capacity * 100)
    : 0
  const status = rate >= thresholdCritical ? 'saturé' : rate >= thresholdWarning ? 'chargé' : 'normal'

  const applyOccupationData = useCallback((data) => {
    if (data.occupation  !== undefined) setOccupation(data.occupation)
    if (data.capacity    !== undefined) setCapacity(data.capacity)
    if (data.threshold_warning  !== undefined) setThresholdWarning(data.threshold_warning)
    if (data.threshold_critical !== undefined) setThresholdCritical(data.threshold_critical)
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/history?limit=100`)
      const data = await res.json()
      setHistory(data)
    } catch { /* silencieux */ }
  }, [])

  const fetchPeak = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/prediction`)
      const data = await res.json()
      if (!data.error && data.peak) {
        setPeakSoon(data.peak.alert_soon)
        setPeakRate(data.peak.rate)
        setPeakHour(data.peak.ds)
      }
    } catch { /* silencieux */ }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res  = await fetch(`${API_URL}/occupation`)
        const data = await res.json()
        applyOccupationData(data)
      } catch { /* silencieux */ }
    }
    init()
    fetchHistory()
    fetchPeak()
    const peakTimer = setInterval(fetchPeak, 5 * 60_000)
    return () => clearInterval(peakTimer)
  }, [applyOccupationData, fetchHistory, fetchPeak])

  const handleWsMessage = useCallback((data) => {
    // Mise à jour occupation + config si diffusion admin
    applyOccupationData(data)
    // Rafraîchir l'historique après tout événement
    if (data.event && data.event !== 'init') fetchHistory()
    // Si historique effacé par admin
    if (data.event === 'history_cleared') setHistory([])
  }, [applyOccupationData, fetchHistory])

  const connected = useWebSocket(handleWsMessage)

  async function handleAdminLogin(username, password) {
    const ok = await login(username, password)
    if (ok) setView('admin')
  }

  function handleLogout() {
    logout()
    setView('public')
  }

  // ── Vue login ─────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <AdminLogin
        onLogin={handleAdminLogin}
        onBack={() => setView('public')}
        loading={authLoading}
        error={authError}
      />
    )
  }

  // ── Vue admin ─────────────────────────────────────────────────
  if (view === 'admin' && isAdmin) {
    return (
      <AdminPanel
        authFetch={authFetch}
        onLogout={handleLogout}
        onBack={() => setView('public')}
      />
    )
  }

  // ── Vue publique ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          BiblioFlow
          <span className="ml-2 text-sm font-normal text-gray-500">
            Monitoring d'occupation en temps réel
          </span>
        </h1>
        <button
          onClick={() => isAdmin ? setView('admin') : setView('login')}
          className="text-sm px-4 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
        >
          {isAdmin ? '⚙ Admin' : '🔒 Admin'}
        </button>
      </header>

      <AlertBanner
        status={status}
        rate={rate}
        peakSoon={peakSoon}
        peakRate={peakRate}
        peakHour={peakHour}
      />

      <main className="max-w-5xl mx-auto px-6 py-8 grid gap-6">
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <OccupancyCounter
              occupation={occupation}
              capacity={capacity}
              rate={rate}
              status={status}
              connected={connected}
            />
          </div>
        </div>

        <StatsPanel />

        <HistoryTable data={history} />

        <HistoryChart data={history} capacity={capacity} />

        <PredictionChart capacity={capacity} history={history} />
      </main>
    </div>
  )
}
