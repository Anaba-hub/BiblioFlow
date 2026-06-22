import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryChart({ data, capacity }) {
  const cap = capacity ?? 50
  const t70 = Math.round(cap * 0.7)
  const t90 = Math.round(cap * 0.9)

  // Filtrer uniquement les événements réels pour le graphique
  const realEvents = data ? data.filter(e => e.event_type === 'entry' || e.event_type === 'exit') : []

  if (realEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Courbe d'occupation
        </h2>
        <p className="text-gray-400 text-sm text-center py-12">
          Aucune donnée pour le moment.
        </p>
      </div>
    )
  }

  const chartData = [...realEvents].reverse().map((e) => ({
    time: formatTime(e.timestamp),
    occupation: e.occupation,
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Courbe d'occupation</h2>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-amber-400" />70 % ({t70} pers.)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-red-500" />90 % ({t90} pers.)
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, cap]} />
          <Tooltip
            formatter={(v) => [v, 'Occupation']}
            labelFormatter={(l) => `Heure : ${l}`}
          />
          <ReferenceLine y={t70} stroke="#f59e0b" strokeDasharray="5 3"
            label={{ value: '70 %', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
          <ReferenceLine y={t90} stroke="#ef4444" strokeDasharray="5 3"
            label={{ value: '90 %', position: 'right', fontSize: 10, fill: '#ef4444' }} />
          <Line
            type="monotone"
            dataKey="occupation"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
