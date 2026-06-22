import { useState, useEffect, useCallback } from 'react'
import OccupancyCounter from './components/OccupancyCounter'
import AlertBanner      from './components/AlertBanner'
import StatsPanel       from './components/StatsPanel'
import HistoryTable     from './components/HistoryTable'
import HistoryChart     from './components/HistoryChart'
import PredictionChart  from './components/PredictionChart'
import { useWebSocket } from './hooks/useWebSocket'

const API_URL          = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CAPACITY_DEFAULT = parseInt(import.meta.env.VITE_CAPACITY || '50', 10)

export default function App() {
  const [occupation, setOccupation] = useState(null)
  const [capacity,   setCapacity]   = useState(CAPACITY_DEFAULT)
  const [history,    setHistory]    = useState([])
  const [peakSoon,   setPeakSoon]   = useState(false)
  const [peakRate,   setPeakRate]   = useState(null)
  const [peakHour,   setPeakHour]   = useState(null)

  // Taux et statut calculés côté client
  const rate   = capacity > 0 && occupation != null
    ? Math.round(occupation / capacity * 100)
    : 0
  const status = rate >= 90 ? 'saturé' : rate >= 70 ? 'chargé' : 'normal'

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/history?limit=100`)
      const data = await res.json()
      setHistory(data)
    } catch { /* backend non accessible */ }
  }, [])

  // Vérifie le pic prévu toutes les 5 minutes
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
        setOccupation(data.occupation)
        if (data.capacity) setCapacity(data.capacity)
      } catch { /* backend non accessible */ }
    }
    init()
    fetchHistory()
    fetchPeak()
    const peakTimer = setInterval(fetchPeak, 5 * 60_000)
    return () => clearInterval(peakTimer)
  }, [fetchHistory, fetchPeak])

  const handleWsMessage = useCallback((data) => {
    if (data.occupation !== undefined) setOccupation(data.occupation)
    fetchHistory()
  }, [fetchHistory])

  const connected = useWebSocket(handleWsMessage)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          BiblioFlow
          <span className="ml-2 text-sm font-normal text-gray-500">
            Monitoring d'occupation en temps réel
          </span>
        </h1>
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
