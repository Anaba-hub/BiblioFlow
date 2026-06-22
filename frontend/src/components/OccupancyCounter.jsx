export default function OccupancyCounter({ occupation, connected }) {
  const level =
    occupation >= 80 ? 'red' : occupation >= 50 ? 'amber' : 'green'

  const colors = {
    green: 'bg-green-100 text-green-800 border-green-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  }

  const labels = {
    green: 'Capacité disponible',
    amber: 'Occupation modérée',
    red: 'Quasi complet',
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-gray-500">
          {connected ? 'Connecté en temps réel' : 'Reconnexion…'}
        </span>
      </div>

      <div
        className={`text-8xl font-bold tabular-nums border-4 rounded-full w-48 h-48 flex items-center justify-center ${colors[level]}`}
      >
        {occupation ?? '—'}
      </div>

      <p className="text-lg font-medium text-gray-700">
        {labels[level]}
      </p>
    </div>
  )
}
