import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Historique d'occupation
        </h2>
        <p className="text-gray-400 text-sm text-center py-12">
          Aucune donnée pour le moment.
        </p>
      </div>
    )
  }

  const chartData = [...data].reverse().map((e) => ({
    time: formatTime(e.timestamp),
    occupation: e.occupation,
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        Historique d'occupation
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(v) => [v, 'Occupation']}
            labelFormatter={(l) => `Heure : ${l}`}
          />
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
