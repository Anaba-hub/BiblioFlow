import { useState, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatHour(ds) {
  const d = new Date(ds)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PredictionChart() {
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/prediction`)
      const json = await res.json()
      if (json.error) {
        setError(json.error)
        setForecast(null)
      } else {
        setForecast(json.forecast)
      }
    } catch {
      setError('Impossible de contacter le backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  const chartData = forecast?.map((p) => ({
    time: formatHour(p.ds),
    yhat: parseFloat(p.yhat.toFixed(1)),
    band: [parseFloat(p.yhat_lower.toFixed(1)), parseFloat(p.yhat_upper.toFixed(1))],
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">
          Prévision 24 h (Prophet)
        </h2>
        <button
          onClick={fetch_}
          disabled={loading}
          className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Chargement…' : 'Actualiser la prévision'}
        </button>
      </div>

      {error && (
        <p className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!forecast && !error && (
        <p className="text-gray-400 text-sm text-center py-12">
          Cliquez sur « Actualiser la prévision » pour charger les données.
        </p>
      )}

      {chartData && (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(v, name) =>
                name === 'yhat'
                  ? [v, 'Prévision']
                  : [v, 'Intervalle de confiance']
              }
              labelFormatter={(l) => `Heure : ${l}`}
            />
            <Area
              dataKey="band"
              stroke="none"
              fill="#bfdbfe"
              fillOpacity={0.5}
              name="Intervalle de confiance"
            />
            <Line
              type="monotone"
              dataKey="yhat"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="Prévision"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
