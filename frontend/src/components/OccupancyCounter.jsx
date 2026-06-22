export default function OccupancyCounter({ occupation, capacity, rate, status, connected }) {
  const s   = status   ?? 'normal'
  const cap = capacity ?? 50

  const ringColor = {
    normal: 'border-green-400 bg-green-50  text-green-800',
    chargé: 'border-amber-400 bg-amber-50  text-amber-800',
    saturé: 'border-red-500   bg-red-50    text-red-800',
  }

  const barColor = {
    normal: 'bg-green-500',
    chargé: 'bg-amber-500',
    saturé: 'bg-red-500',
  }

  const statusLabel = { normal: 'Normal', chargé: 'Chargé', saturé: 'Saturé' }

  return (
    <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4">

      {/* Indicateur connexion */}
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full inline-block ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-sm text-gray-500">
          {connected ? 'Connecté en temps réel' : 'Reconnexion…'}
        </span>
      </div>

      {/* Cercle principal */}
      <div className={`border-4 rounded-full w-52 h-52 flex flex-col items-center justify-center gap-0.5 ${ringColor[s]}`}>
        <span className="text-5xl font-bold tabular-nums leading-none">
          {occupation ?? '—'}
        </span>
        <span className="text-sm font-medium">/ {cap} pers.</span>
        <span className="text-2xl font-bold mt-1">
          {rate != null ? `${rate} %` : '—'}
        </span>
      </div>

      {/* Badge statut */}
      <span className={`px-4 py-1 rounded-full text-sm font-semibold ${
        s === 'saturé' ? 'bg-red-100 text-red-700' :
        s === 'chargé' ? 'bg-amber-100 text-amber-700' :
                         'bg-green-100 text-green-700'
      }`}>
        {statusLabel[s]}
      </span>

      {/* Barre de progression */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>0</span>
          <span className="text-amber-500 font-medium">70 %</span>
          <span className="text-red-500 font-medium">90 %</span>
          <span>{cap} pers.</span>
        </div>
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Marqueurs seuil */}
          <div className="absolute top-0 bottom-0 w-px bg-amber-400" style={{ left: '70%' }} />
          <div className="absolute top-0 bottom-0 w-px bg-red-500"   style={{ left: '90%' }} />
          {/* Barre remplie */}
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor[s]}`}
            style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
