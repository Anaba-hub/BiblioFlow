import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50  text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    red:    'bg-red-50   text-red-700',
    gray:   'bg-gray-50  text-gray-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function formatUptime(s) {
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
}

export default function AdminPanel({ authFetch, onLogout, onBack }) {
  const [tab,        setTab]        = useState('system')
  const [config,     setConfig]     = useState(null)
  const [form,       setForm]       = useState({ capacity: 50, threshold_warning: 70, threshold_critical: 90 })
  const [resetValue, setResetValue] = useState(0)
  const [saving,     setSaving]     = useState(false)
  const [message,    setMessage]    = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/admin/config`)
      if (res.status === 401) { onLogout(); return }
      const data = await res.json()
      setConfig(data)
      setForm({
        capacity:           data.capacity,
        threshold_warning:  data.threshold_warning,
        threshold_critical: data.threshold_critical,
      })
    } catch {
      setMessage({ type: 'error', text: 'Impossible de charger la configuration.' })
    }
  }, [authFetch, onLogout])

  useEffect(() => {
    loadConfig()
    const id = setInterval(loadConfig, 15_000)
    return () => clearInterval(id)
  }, [loadConfig])

  function flash(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function saveConfig() {
    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/admin/config`, {
        method: 'POST',
        body:   JSON.stringify(form),
      })
      if (res.status === 401) { onLogout(); return }
      if (!res.ok) {
        const err = await res.json()
        flash('error', err.detail)
      } else {
        flash('success', 'Configuration mise à jour et diffusée en temps réel.')
        loadConfig()
      }
    } catch {
      flash('error', 'Erreur réseau.')
    } finally {
      setSaving(false)
    }
  }

  async function doReset() {
    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/admin/reset-occupation`, {
        method: 'POST',
        body:   JSON.stringify({ value: resetValue }),
      })
      if (res.status === 401) { onLogout(); return }
      flash('success', `Occupation remise à ${resetValue} personne(s).`)
      loadConfig()
    } catch {
      flash('error', 'Erreur réseau.')
    } finally {
      setSaving(false)
    }
  }

  async function doClear() {
    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/admin/history`, { method: 'DELETE' })
      if (res.status === 401) { onLogout(); return }
      flash('success', 'Historique effacé. Le compteur est remis à 0.')
      setConfirmClear(false)
      loadConfig()
    } catch {
      flash('error', 'Erreur réseau.')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'system', label: 'Système' },
    { id: 'config', label: 'Configuration' },
    { id: 'actions', label: 'Actions' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header admin */}
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">BiblioFlow — Administration</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {config
              ? `Capacité : ${config.capacity} pers. · MQTT : ${config.mqtt_connected ? '✅ Connecté' : '❌ Déconnecté'}`
              : 'Chargement…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            ← Dashboard
          </button>
          <button
            onClick={onLogout}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Flash message */}
      {message && (
        <div className={`px-6 py-3 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 border-b border-green-200'
            : 'bg-red-100 text-red-800 border-b border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Onglets */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB SYSTÈME ─────────────────────────────────────────── */}
        {tab === 'system' && config && (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Occupation"
                value={`${config.current_occupation} / ${config.capacity}`}
                sub={`${config.rate} %`}
                color={config.rate >= config.threshold_critical ? 'red' : config.rate >= config.threshold_warning ? 'amber' : 'green'}
              />
              <StatCard
                label="MQTT"
                value={config.mqtt_connected ? 'Connecté' : 'Déconnecté'}
                color={config.mqtt_connected ? 'green' : 'red'}
              />
              <StatCard
                label="Uptime"
                value={formatUptime(config.uptime_seconds)}
                color="blue"
              />
              <StatCard
                label="Événements DB"
                value={config.db_stats?.total_events ?? '—'}
                sub={`${config.db_stats?.entries ?? 0} entrées · ${config.db_stats?.exits ?? 0} sorties`}
                color="gray"
              />
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-4">Détail des événements</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {[
                  { label: 'Entrées (total)',  value: config.db_stats?.entries  ?? 0, color: 'text-green-600' },
                  { label: 'Sorties (total)',  value: config.db_stats?.exits    ?? 0, color: 'text-blue-600' },
                  { label: 'Suspects (total)', value: config.db_stats?.suspects ?? 0, color: 'text-amber-600' },
                  { label: 'Capacité max',     value: `${config.capacity} pers.`, color: 'text-gray-700' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Logique de comptage</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { seq: 'A → B', result: 'ENTRÉE (+1)',    color: 'bg-green-50 border-green-200 text-green-800' },
                  { seq: 'B → A', result: 'SORTIE (−1)',    color: 'bg-blue-50  border-blue-200  text-blue-800' },
                  { seq: 'A seul (timeout)', result: 'IGNORÉ + stocké',  color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { seq: 'A → A ou B → B',  result: 'DEMI-TOUR (ignoré)', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                ].map(({ seq, result, color }) => (
                  <div key={seq} className={`flex items-center justify-between rounded-lg border px-4 py-2 ${color}`}>
                    <span className="font-mono font-semibold">{seq}</span>
                    <span className="font-medium">{result}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONFIGURATION ───────────────────────────────────── */}
        {tab === 'config' && (
          <div className="bg-white rounded-2xl shadow p-6 max-w-lg">
            <h2 className="text-base font-semibold text-gray-700 mb-6">Paramètres</h2>
            <div className="flex flex-col gap-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacité maximale (personnes)
                </label>
                <input
                  type="number"
                  min={1} max={10000}
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 50 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Valeur actuelle en base : {config?.capacity ?? '—'} pers.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seuil d'alerte orange (%)
                </label>
                <input
                  type="number"
                  min={1} max={99}
                  value={form.threshold_warning}
                  onChange={e => setForm(f => ({ ...f, threshold_warning: parseInt(e.target.value) || 70 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Déclenche à {Math.round(form.capacity * form.threshold_warning / 100)} pers.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seuil critique rouge (%)
                </label>
                <input
                  type="number"
                  min={form.threshold_warning + 1} max={100}
                  value={form.threshold_critical}
                  onChange={e => setForm(f => ({ ...f, threshold_critical: parseInt(e.target.value) || 90 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Déclenche à {Math.round(form.capacity * form.threshold_critical / 100)} pers.
                </p>
              </div>

              {/* Aperçu */}
              <div className="rounded-xl bg-gray-50 p-4 text-sm">
                <p className="font-medium text-gray-600 mb-2">Aperçu des zones</p>
                <div className="w-full h-4 rounded-full overflow-hidden flex">
                  <div className="bg-green-400 h-full" style={{ width: `${form.threshold_warning}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${form.threshold_critical - form.threshold_warning}%` }} />
                  <div className="bg-red-500 h-full"   style={{ width: `${100 - form.threshold_critical}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Normal (0–{form.threshold_warning} %)</span>
                  <span>Chargé</span>
                  <span>Saturé (&gt;{form.threshold_critical} %)</span>
                </div>
              </div>

              <button
                onClick={saveConfig}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Application…' : 'Appliquer la configuration'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Les changements sont diffusés instantanément à tous les utilisateurs connectés.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB ACTIONS ─────────────────────────────────────────── */}
        {tab === 'actions' && (
          <div className="flex flex-col gap-6 max-w-lg">

            {/* Reset occupation */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-1">Réinitialiser l'occupation</h2>
              <p className="text-sm text-gray-500 mb-4">
                Utile après une coupure ou une erreur de comptage. Un événement "reset" est enregistré dans l'historique.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={config?.capacity ?? 500}
                  value={resetValue}
                  onChange={e => setResetValue(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">personnes</span>
                <button
                  onClick={doReset}
                  disabled={saving}
                  className="ml-auto px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? '…' : 'Appliquer'}
                </button>
              </div>
            </div>

            {/* Clear history */}
            <div className="bg-white rounded-2xl shadow p-6 border border-red-100">
              <h2 className="text-base font-semibold text-red-700 mb-1">Effacer l'historique</h2>
              <p className="text-sm text-gray-500 mb-4">
                Supprime <strong>définitivement</strong> tous les événements de la base de données.
                Cette action est irréversible.
              </p>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Effacer tout l'historique
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-red-600 font-medium">Confirmer la suppression ?</p>
                  <button
                    onClick={doClear}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '…' : 'Oui, effacer'}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
