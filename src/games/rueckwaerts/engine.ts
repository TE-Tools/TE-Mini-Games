/**
 * Rückwärts – reine Spiellogik (kein React, kein DOM, kein Mikrofon).
 *
 * Jemand spricht heimlich ein Wort ein. Die zweite Person hört es
 * rückwärts und spricht nach, was sie hört. Diese Nachahmung läuft wieder
 * rückwärts -- war sie gut, steht das Wort damit wieder richtig herum --,
 * und die übrigen raten, was es war.
 *
 * Zwei Dinge gehören hierher und nirgends sonst hin:
 *
 * 1. **Was wann zu hören ist.** Die Seite fragt `hoerbar()` und zeigt an,
 *    was sie bekommt. Wer nachspricht, bekommt das Original nie richtig
 *    herum; wer rät, bekommt nur die umgedrehte Nachahmung.
 * 2. **Das Löschen.** Eine Aufnahme ist eine Stimme. Sie liegt nur in
 *    diesem Zustand, und jeder Weg aus einer Runde heraus -- nächste Runde,
 *    neu einsprechen, beenden, Seite verlassen -- überschreibt sie mit
 *    Nullen, bevor er sie loslässt. Loslassen allein genügt nicht: Dann
 *    entscheidet die Speicherverwaltung, wann die Werte wirklich weg sind.
 */

import { RUECKWAERTS } from './config'

/** Eine Aufnahme: Ausschläge zwischen -1 und 1, dazu die Abtastrate. */
export interface Klang {
  samples: Float32Array
  rate: number
}

export interface RueckSpieler {
  id: string
  name: string
}

export type RueckPhase = 'einsprechen' | 'nachsprechen' | 'raten' | 'aufloesung' | 'ende'

export interface RueckZustand {
  phase: RueckPhase
  spieler: RueckSpieler[]
  /** Zählt ab 1. */
  runde: number
  /** Das Wort, wie es eingesprochen wurde -- und umgedreht. */
  original: Klang | null
  originalRueckwaerts: Klang | null
  /** Die Nachahmung, wie sie eingesprochen wurde -- und umgedreht. */
  nachahmung: Klang | null
  nachahmungRueckwaerts: Klang | null
  /** Abgeschlossene Runden und wie viele davon erraten wurden. */
  gespielt: number
  erraten: number
}

/** Warum eine Aufnahme nicht zählt. Als Kennung, der Satz dazu steht im Wörterbuch. */
export type AufnahmeMangel = 'kein-ton' | 'zu-leise' | 'zu-kurz'

/**
 * Was an einer abgewiesenen Aufnahme gemessen wurde -- für die Zeile unter
 * der Fehlermeldung. Ohne sie lässt sich aus der Ferne nicht sagen, ob ein
 * Gerät nichts liefert, zu leise ist oder nur kurz aufgenommen hat.
 */
export interface Messung {
  /** Wie viel überhaupt aufgenommen wurde. */
  sekunden: number
  /** Das lauteste anhaltende Stück (quadratischer Mittelwert). */
  stimme: number
  /** Das Grundrauschen. */
  rauschen: number
}

export type AufnahmeErgebnis =
  { ok: true; zustand: RueckZustand } | { ok: false; grund: AufnahmeMangel; messung: Messung }

/** Was es zu hören gibt. Die Namen sagen, was es ist und wie herum. */
export type HoerArt = 'original' | 'original-rueckwaerts' | 'nachahmung' | 'nachahmung-rueckwaerts'

export const MIN_SPIELER = RUECKWAERTS.minSpieler
export const MAX_SPIELER = RUECKWAERTS.maxSpieler

/* ------------------------------------------------------------------ */
/* Klang                                                               */
/* ------------------------------------------------------------------ */

/** Dieselbe Aufnahme von hinten nach vorn. Die Vorlage bleibt unberührt. */
export function kehreUm(klang: Klang): Klang {
  const n = klang.samples.length
  const um = new Float32Array(n)
  for (let i = 0; i < n; i++) um[i] = klang.samples[n - 1 - i]!
  return { samples: um, rate: klang.rate }
}

/** Überschreibt eine Aufnahme mit Stille. Danach ist sie nicht wiederherzustellen. */
export function ueberschreibe(klang: Klang | null): void {
  klang?.samples.fill(0)
}

/** Länge in Sekunden. */
export function dauer(klang: Klang): number {
  return klang.rate > 0 ? klang.samples.length / klang.rate : 0
}

/**
 * Schneidet die Stille vor und hinter der Stimme weg, hebt leise Aufnahmen
 * an und prüft, ob überhaupt etwas zu hören war.
 *
 * Gemessen wird in Fenstern von zwanzig Millisekunden (quadratischer
 * Mittelwert). Nichts hier hängt an einer festen Lautstärke -- Handys
 * liefern die Stimme teils hundertmal leiser als ein Rechner:
 *
 * - **Maßstab ist das lauteste anhaltende Stück**, nicht das lauteste
 *   Fenster. Der Fingertipp auf „Stopp" ist oft lauter als das Wort, aber
 *   nach einem Fenster vorbei; als Maßstab würde er das Wort zur Stille
 *   erklären.
 * - **Stimme ist, was sich vom Grundrauschen abhebt.** Gleichmäßiges
 *   Rauschen hebt sich von sich selbst nicht ab und wird zurückgewiesen,
 *   egal wie laut es ist.
 * - Stimme beginnt und endet, wo mehrere laute Fenster aufeinander folgen;
 *   ein einzelnes ist ein Knacks.
 *
 * Das Ergebnis ist eine eigene Kopie; die Vorlage kann der Aufrufer danach
 * überschreiben.
 */
export function stutze(
  roh: Klang,
): { ok: true; klang: Klang } | { ok: false; grund: AufnahmeMangel; messung: Messung } {
  const { samples, rate } = roh
  const sekunden = rate > 0 ? samples.length / rate : 0
  const nein = (grund: AufnahmeMangel, stimme = 0, rauschen = 0) =>
    ({ ok: false, grund, messung: { sekunden, stimme, rauschen } }) as const
  const fenster = Math.max(1, Math.round(rate * RUECKWAERTS.fensterSekunden))
  const anzahl = Math.floor(samples.length / fenster)
  const folge = RUECKWAERTS.fensterInFolge
  if (anzahl < folge) return nein('zu-kurz')

  const laut = new Float32Array(anzahl)
  for (let f = 0; f < anzahl; f++) {
    let summe = 0
    const ab = f * fenster
    for (let i = ab; i < ab + fenster; i++) {
      const v = samples[i]!
      summe += v * v
    }
    laut[f] = Math.sqrt(summe / fenster)
  }

  // Das lauteste Stück, das `folge` Fenster lang anhält.
  let spitze = 0
  for (let f = 0; f + folge <= anzahl; f++) {
    let leisestes = laut[f]!
    for (let k = 1; k < folge; k++) leisestes = Math.min(leisestes, laut[f + k]!)
    if (leisestes > spitze) spitze = leisestes
  }
  const sortiert = Float32Array.from(laut).sort()
  const grund = sortiert[Math.floor((anzahl - 1) * RUECKWAERTS.grundAnteil)]!
  if (spitze < RUECKWAERTS.keinTon) return nein('kein-ton', spitze, grund)
  if (spitze < RUECKWAERTS.sicherLaut && spitze < grund * RUECKWAERTS.abstandZumGrund) {
    return nein('zu-leise', spitze, grund)
  }

  const schwelle = Math.min(
    Math.max(spitze * RUECKWAERTS.stilleAnteil, grund * RUECKWAERTS.grundFaktor),
    spitze * RUECKWAERTS.hoechsterSchwellenAnteil,
  )
  let erstes = -1
  let letztes = -1
  let lauf = 0
  for (let f = 0; f < anzahl; f++) {
    lauf = laut[f]! >= schwelle ? lauf + 1 : 0
    if (lauf >= folge) {
      if (erstes < 0) erstes = f - lauf + 1
      letztes = f
    }
  }
  if (erstes < 0) return nein('zu-kurz', spitze, grund)

  const rand = Math.round(rate * RUECKWAERTS.randSekunden)
  const von = Math.max(0, erstes * fenster - rand)
  const bis = Math.min(samples.length, (letztes + 1) * fenster + rand)
  const stimme = (letztes - erstes + 1) * fenster
  if (stimme / rate < RUECKWAERTS.minSekunden) return nein('zu-kurz', spitze, grund)

  // slice() kopiert -- subarray() wäre nur ein Fenster auf die Vorlage und
  // würde mit ihr zusammen überschrieben.
  const stueck = samples.slice(von, bis)
  let gipfel = 0
  for (let i = 0; i < stueck.length; i++) gipfel = Math.max(gipfel, Math.abs(stueck[i]!))
  const faktor = Math.min(RUECKWAERTS.zielGipfel / gipfel, RUECKWAERTS.maxVerstaerkung)
  if (faktor > 1) for (let i = 0; i < stueck.length; i++) stueck[i] = stueck[i]! * faktor
  return { ok: true, klang: { samples: stueck, rate } }
}

/**
 * Wie weit die Pegelanzeige ausschlägt (0 bis 1), wenn das Mikrofon gerade
 * `rms` liefert. Nach Dezibel und nicht geradlinig: Eine leise Stimme
 * liegt bei einem Hundertstel des vollen Ausschlags und soll trotzdem
 * sichtbar etwas bewegen -- die Anzeige ist dazu da, dass man sieht, ob das
 * Mikrofon einen hört. -66 dB ist der Anschlag unten, -6 dB der oben.
 */
export function pegelAnzeige(rms: number): number {
  if (!(rms > 0)) return 0
  const dezibel = 20 * Math.log10(rms)
  return Math.min(1, Math.max(0, (dezibel + 66) / 60))
}

/* ------------------------------------------------------------------ */
/* Partie                                                              */
/* ------------------------------------------------------------------ */

function bereinigeNamen(namen: string[]): string[] {
  const sauber = namen.map((n) => n.trim()).filter(Boolean)
  if (sauber.length < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (sauber.length > MAX_SPIELER) throw new Error(`Maximal ${MAX_SPIELER} Spieler`)
  const gesehen = new Set<string>()
  for (const n of sauber) {
    const schluessel = n.toLowerCase()
    if (gesehen.has(schluessel)) throw new Error(`Name doppelt: ${n}`)
    gesehen.add(schluessel)
  }
  return sauber
}

export function createRueckwaertsMatch(optionen: { names: string[] }): RueckZustand {
  const namen = bereinigeNamen(optionen.names)
  return {
    phase: 'einsprechen',
    spieler: namen.map((name, i) => ({ id: `p${i + 1}`, name })),
    runde: 1,
    original: null,
    originalRueckwaerts: null,
    nachahmung: null,
    nachahmungRueckwaerts: null,
    gespielt: 0,
    erraten: 0,
  }
}

/**
 * Wer in dieser Runde was tut. Die Rollen wandern jede Runde einen Platz
 * weiter. Zu zweit rät, wer nachgesprochen hat -- sonst raten alle, die
 * weder eingesprochen noch nachgesprochen haben.
 */
export function rollen(z: RueckZustand): {
  sprecher: RueckSpieler
  nachsprecher: RueckSpieler
  rater: RueckSpieler[]
} {
  const n = z.spieler.length
  const i = (z.runde - 1) % n
  const sprecher = z.spieler[i]!
  const nachsprecher = z.spieler[(i + 1) % n]!
  const uebrige = z.spieler.filter((p) => p !== sprecher && p !== nachsprecher)
  return { sprecher, nachsprecher, rater: uebrige.length > 0 ? uebrige : [nachsprecher] }
}

function verlange(z: RueckZustand, phase: RueckPhase, was: string): void {
  if (z.phase !== phase)
    throw new Error(`${was} geht nur in der Phase ${phase}, nicht in ${z.phase}`)
}

/** Das eingesprochene Wort. Zählt die Aufnahme nicht, bleibt alles, wie es war. */
export function nimmOriginal(z: RueckZustand, roh: Klang): AufnahmeErgebnis {
  verlange(z, 'einsprechen', 'Einsprechen')
  const gestutzt = stutze(roh)
  if (!gestutzt.ok) return gestutzt
  return {
    ok: true,
    zustand: {
      ...z,
      phase: 'nachsprechen',
      original: gestutzt.klang,
      originalRueckwaerts: kehreUm(gestutzt.klang),
    },
  }
}

/** Das Wort war ein Versehen: verwerfen und noch einmal einsprechen. */
export function neuEinsprechen(z: RueckZustand): RueckZustand {
  verlange(z, 'nachsprechen', 'Neu einsprechen')
  ueberschreibe(z.original)
  ueberschreibe(z.originalRueckwaerts)
  return { ...z, phase: 'einsprechen', original: null, originalRueckwaerts: null }
}

/** Die Nachahmung dessen, was rückwärts zu hören war. */
export function nimmNachahmung(z: RueckZustand, roh: Klang): AufnahmeErgebnis {
  verlange(z, 'nachsprechen', 'Nachsprechen')
  const gestutzt = stutze(roh)
  if (!gestutzt.ok) return gestutzt
  return {
    ok: true,
    zustand: {
      ...z,
      phase: 'raten',
      nachahmung: gestutzt.klang,
      nachahmungRueckwaerts: kehreUm(gestutzt.klang),
    },
  }
}

export function aufloesen(z: RueckZustand): RueckZustand {
  verlange(z, 'raten', 'Auflösen')
  return { ...z, phase: 'aufloesung' }
}

/**
 * Überschreibt alle vier Aufnahmen und gibt einen Zustand ohne sie zurück.
 * Für jeden Weg aus einer Runde heraus -- auch den, bei dem die Seite
 * einfach geschlossen wird.
 */
export function verwerfeAufnahmen(z: RueckZustand): RueckZustand {
  ueberschreibe(z.original)
  ueberschreibe(z.originalRueckwaerts)
  ueberschreibe(z.nachahmung)
  ueberschreibe(z.nachahmungRueckwaerts)
  return {
    ...z,
    original: null,
    originalRueckwaerts: null,
    nachahmung: null,
    nachahmungRueckwaerts: null,
  }
}

/** Runde abschließen: zählen, Aufnahmen löschen, Rollen weiterrücken. */
export function naechsteRunde(z: RueckZustand, richtigGeraten: boolean): RueckZustand {
  verlange(z, 'aufloesung', 'Die nächste Runde')
  return {
    ...verwerfeAufnahmen(z),
    phase: 'einsprechen',
    runde: z.runde + 1,
    gespielt: z.gespielt + 1,
    erraten: z.erraten + (richtigGeraten ? 1 : 0),
  }
}

/** Partie beenden. Geht aus jeder Phase; eine angefangene Runde zählt nicht. */
export function beenden(z: RueckZustand): RueckZustand {
  return { ...verwerfeAufnahmen(z), phase: 'ende' }
}

/* ------------------------------------------------------------------ */
/* Was zu hören ist                                                    */
/* ------------------------------------------------------------------ */

/**
 * Was in der jetzigen Phase abgespielt werden darf, in der Reihenfolge
 * der Knöpfe. Hier steht die eigentliche Regel des Spiels: Wer
 * nachspricht, hört das Wort nur rückwärts. Wer rät, hört nur die
 * umgedrehte Nachahmung. Erst die Auflösung gibt alles frei.
 */
export function hoerbar(z: RueckZustand): HoerArt[] {
  switch (z.phase) {
    case 'nachsprechen':
      return ['original-rueckwaerts']
    case 'raten':
      return ['nachahmung-rueckwaerts']
    case 'aufloesung':
      return ['original', 'original-rueckwaerts', 'nachahmung', 'nachahmung-rueckwaerts']
    default:
      return []
  }
}

/** Die Aufnahme zu einer Art -- nur, wenn sie in dieser Phase zu hören sein darf. */
export function klangFuer(z: RueckZustand, art: HoerArt): Klang {
  if (!hoerbar(z).includes(art)) {
    throw new Error(`${art} ist in der Phase ${z.phase} nicht zu hören`)
  }
  const klang =
    art === 'original'
      ? z.original
      : art === 'original-rueckwaerts'
        ? z.originalRueckwaerts
        : art === 'nachahmung'
          ? z.nachahmung
          : z.nachahmungRueckwaerts
  if (!klang) throw new Error(`${art} fehlt`)
  return klang
}
