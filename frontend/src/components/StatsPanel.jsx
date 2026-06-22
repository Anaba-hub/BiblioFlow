import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key'

export default function StatsPanel() {
  const [stats, setStats]     = useState(null)
  const [anomaly, setAnomaly] = useState(null)

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60_000)
    return () => clearInterval(id)
  }, [])

  async function fetchAll() {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/anomalies`, { headers: { 'X-Api-Key': API_KEY } }),
      ])
      if (sRes.ok) setStats(await sRes.json())
      if (aRes.ok) setAnomaly(await aRes.json())
    } catch {
      // backend non accessible
    }
  }

  if (!stats) return null

  const trendColor = {
    hausse: 'text-red-600',
    baisse: 'text-blue-600',
    stable: 'text-green-600',
  }

  const cards = [
    { label: "Entrées aujourd'hui", value: stats.entries_today },
    { label: "Sorties aujourd'hui", value: stats.exits_today },
    { label: 'Heure de pointe',     value: stats.peak_hour ?? '—' },
    { label: 'Occ. max aujourd\'hui', value: stats.peak_occupation },
  ]

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Statistiques du jour</h2>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${trendColor[stats.trend] ?? 'text-gray-500'}`}>
            Tendance : {stats.trend}
          </span>
          {anomaly?.anomaly && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
              ⚠ Anomalie IA
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {anomaly?.anomaly && anomaly.message && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
          {anomaly.message}
        </p>
      )}
    </div>
  )
}
