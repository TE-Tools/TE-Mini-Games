/**
 * Wie lange das heutige Tagesziel noch gilt: bis zur nächsten Mitternacht
 * nach Ortszeit -- dann wechselt `todayKey()` und damit die Aufgabe.
 *
 * Aufgerundet auf volle Minuten, damit „00:00" nicht schon eine Minute vor
 * dem Wechsel dasteht. An Tagen mit Zeitumstellung stimmt es auch: Die
 * nächste Mitternacht wird als Datum gebildet, nicht als „jetzt + 24 h".
 */
export function bisMitternacht(jetzt: Date): string {
  const morgen = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1)
  const minuten = Math.max(0, Math.ceil((morgen.getTime() - jetzt.getTime()) / 60000))
  const hh = String(Math.floor(minuten / 60)).padStart(2, '0')
  const mm = String(minuten % 60).padStart(2, '0')
  return `${hh}:${mm}`
}
