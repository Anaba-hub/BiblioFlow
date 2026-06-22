export default function AlertBanner({ status, rate, peakSoon, peakRate, peakHour }) {
  const alerts = []

  if (status === 'saturé') {
    alerts.push({
      bg:  'bg-red-600 text-white',
      msg: `🔴 ALERTE CRITIQUE — ${rate} % d'occupation (≥ 90 %) · Bibliothèque saturée`,
    })
  } else if (status === 'chargé') {
    alerts.push({
      bg:  'bg-amber-500 text-white',
      msg: `⚠ Occupation élevée — ${rate} % (≥ 70 %) · Bibliothèque chargée`,
    })
  }

  if (peakSoon) {
    const heure = peakHour
      ? new Date(peakHour).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—'
    alerts.push({
      bg:  'bg-yellow-100 text-yellow-800 border border-yellow-300',
      msg: `📈 Pic d'occupation prévu — ${peakRate} % estimé vers ${heure}`,
    })
  }

  if (alerts.length === 0) return null

  return (
    <div>
      {alerts.map((a, i) => (
        <div key={i} className={`px-6 py-3 text-sm font-medium ${a.bg}`}>
          {a.msg}
        </div>
      ))}
    </div>
  )
}
