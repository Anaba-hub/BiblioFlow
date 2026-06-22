import { useState, useEffect, useCallback } from 'react'
import OccupancyCounter from './components/OccupancyCounter'
import HistoryChart from './components/HistoryChart'
import PredictionChart from './components/PredictionChart'
import StatsPanel from './components/StatsPanel'
import { useWebSocket } from './hooks/useWebSocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [occupation, setOccupation] = useState(null)
  const [history, setHistory] = useState([])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/history?limit=100`)
      const data = await res.json()
      setHistory(data)
    } catch {
      // backend not reachable yet
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API_URL}/occupation`)
        const data = await res.json()
        setOccupation(data.occupation)
      } catch {
        // backend not reachable yet
      }
    }
    init()
    fetchHistory()
  }, [fetchHistory])

  const handleWsMessage = useCallback(
    (data) => {
      if (data.occupation !== undefined) setOccupation(data.occupation)
      fetchHistory()
    },
    [fetchHistory],
  )

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

      <main className="max-w-5xl mx-auto px-6 py-8 grid gap-6">
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <OccupancyCounter occupation={occupation} connected={connected} />
          </div>
        </div>

        <StatsPanel />

        <HistoryChart data={history} />

        <PredictionChart />
      </main>
    </div>
  )
}
