function formatDT(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const EVENT_META = {
  entry:     { label: 'Entrée',     rowCls: 'bg-green-50', badgeCls: 'bg-green-100 text-green-700' },
  exit:      { label: 'Sortie',     rowCls: 'bg-blue-50',  badgeCls: 'bg-blue-100 text-blue-700' },
  timeout:   { label: 'Timeout',    rowCls: 'bg-amber-50', badgeCls: 'bg-amber-100 text-amber-700' },
  half_turn: { label: 'Demi-tour',  rowCls: 'bg-amber-50', badgeCls: 'bg-amber-100 text-amber-700' },
}

export default function HistoryTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Historique des passages</h2>
        <p className="text-gray-400 text-sm text-center py-8">Aucun événement enregistré.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        Historique des passages
        <span className="ml-2 text-sm font-normal text-gray-400">({data.length} événements)</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 text-gray-500 text-left text-xs uppercase tracking-wide">
              <th className="pb-2 pr-4">Date / Heure</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Personnes</th>
              <th className="pb-2 pr-4 text-right">Taux</th>
              <th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => {
              const m = EVENT_META[e.event_type] ?? {
                label: e.event_type,
                rowCls: '',
                badgeCls: 'bg-gray-100 text-gray-600',
              }
              const isSuspect = e.event_type === 'timeout' || e.event_type === 'half_turn'
              return (
                <tr key={i} className={`border-b border-gray-100 ${m.rowCls}`}>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-600">{formatDT(e.timestamp)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.badgeCls}`}>
                      {m.label}
                    </span>
                    {isSuspect && (
                      <span className="ml-1 text-xs text-gray-400 italic">ignoré</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums">{e.occupation}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {e.rate != null ? `${e.rate} %` : '—'}
                  </td>
                  <td className="py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${
                      e.status === 'saturé' ? 'bg-red-100 text-red-600' :
                      e.status === 'chargé' ? 'bg-amber-100 text-amber-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {e.status ?? '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
