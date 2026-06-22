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
  ReferenceLine,
} from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatHour(ds) {
  return new Date(ds).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PredictionChart({ capacity, history }) {
  const [forecast, setForecast] = useState(null)
  const [peak, setPeak]         = useState(null)
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const cap = capacity ?? 50
  const t70 = Math.round(cap * 0.7)
  const t90 = Math.round(cap * 0.9)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${API_URL}/prediction`)
      const json = await res.json()
      if (json.error) {
        setError(json.error)
        setForecast(null)
        setPeak(null)
      } else {
        setForecast(json.forecast)
        setPeak(json.peak ?? null)
      }
    } catch {
      setError('Impossible de contacter le backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Construire données fusionnées : forecast + réel (dernières heures)
  const chartData = forecast?.map((p) => {
    const hourStr = p.ds.slice(0, 13) // "2026-06-22T14"
    // Chercher la valeur réelle la plus proche de cette heure
    const real = history?.find(
      (h) => (h.event_type === 'entry' || h.event_type === 'exit')
        && h.timestamp.slice(0, 13) === hourStr
    )
    return {
      time:  formatHour(p.ds),
      yhat:  parseFloat(p.yhat.toFixed(1)),
      band:  [parseFloat(p.yhat_lower.toFixed(1)), parseFloat(p.yhat_upper.toFixed(1))],
      reel:  real ? real.occupation : null,
    }
  })

  const peakHourLabel = peak
    ? new Date(peak.ds).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Prévision 24 h (Prophet)</h2>
        <button
          onClick={fetch_}
          disabled={loading}
          className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Chargement…' : 'Actualiser la prévision'}
        </button>
      </div>

      {/* Encart pic prévu */}
      {peak && (
        <div className={`mb-4 flex items-center gap-4 rounded-xl px-4 py-3 text-sm
          ${peak.rate >= 90 ? 'bg-red-50 border border-red-200' :
            peak.rate >= 70 ? 'bg-amber-50 border border-amber-200' :
                              'bg-blue-50 border border-blue-200'}`}>
          <div>
            <p className="font-semibold text-gray-700">Pic prévu</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{peakHourLabel}</p>
          </div>
          <div className="border-l border-gray-200 pl-4">
            <p className="text-gray-500">Occupation estimée</p>
            <p className="text-xl font-bold tabular-nums">{peak.yhat} pers. <span className="text-base">({peak.rate} %)</span></p>
          </div>
          {peak.alert_soon && (
            <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              ⚠ Pic imminent
            </span>
          )}
        </div>
      )}

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
        <>
          <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-blue-600 inline-block" />Prévision
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-green-500 inline-block" />Réel
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-amber-400 border-dashed border inline-block" />70 %
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-red-500 border-dashed border inline-block" />90 %
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, cap]} />
              <Tooltip
                formatter={(v, name) => {
                  if (name === 'yhat') return [v, 'Prévision']
                  if (name === 'reel') return [v, 'Réel']
                  return [v, 'Intervalle']
                }}
                labelFormatter={(l) => `Heure : ${l}`}
              />
              <ReferenceLine y={t70} stroke="#f59e0b" strokeDasharray="5 3" />
              <ReferenceLine y={t90} stroke="#ef4444" strokeDasharray="5 3" />
              <Area dataKey="band" stroke="none" fill="#bfdbfe" fillOpacity={0.4} name="Intervalle" />
              <Line type="monotone" dataKey="yhat"  stroke="#2563eb" strokeWidth={2} dot={false} name="yhat" />
              <Line type="monotone" dataKey="reel"  stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }}
                connectNulls={false} name="reel" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
