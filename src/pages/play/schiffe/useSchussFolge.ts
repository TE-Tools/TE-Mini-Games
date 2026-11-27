/**
 * Zwischen Partie und Bild: Welche Schüsse sind schon eingeschlagen?
 *
 * Die Engine (oder der Server) kennt das Ergebnis eines Schusses sofort.
 * Zu sehen sein soll es erst, wenn die Rakete ankommt. Deshalb zählt dieser
 * Haken je Seite mit, wie viele Schüsse schon gezeigt werden, und schickt
 * für jeden weiteren eine Rakete los -- einen nach dem anderen. Solange eine
 * fliegt, ist `fliegt` gesetzt, und die Seite nimmt keinen Schuss an.
 *
 * Online kommt das Ergebnis des eigenen Schusses erst vom Server. Damit die
 * Rakete trotzdem sofort startet, gibt es `vorab(feld)`: Sie fliegt los und
 * schlägt ein, sobald der Server geantwortet hat.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  felderVon,
  istVersenkt,
  type Schiff,
  type SchiffId,
  type Schuss,
  type Sicht,
} from '@/games/schiffe-versenken'
import { spiele, vibriere } from '@/services/sound'
import { erstelleEffekte, type Effekte, type Punkt } from './effekte'

export interface Meldung {
  nr: number
  /** Auf welchem Meer: dem fremden (mein Schuss) oder dem eigenen. */
  brett: 'ziel' | 'eigen'
  ergebnis: Schuss['ergebnis']
  /** Wo eingeschlagen wurde -- die Meldung steht auf der anderen Hälfte des Meeres. */
  feld: number
  schiff?: SchiffId
}

interface Stand {
  key: string
  mein: number
  sein: number
}

interface Warte {
  feld: number
  loese: (s: Schuss | null) => void
}

function mitteVon(brett: HTMLElement | null, feld: number): { p: Punkt; zelle: number } | null {
  const el = brett?.querySelector<HTMLElement>(`[data-feld="${feld}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { p: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, zelle: r.width }
}

function klang(art: 'start' | 'wasser' | 'treffer' | 'versenkt') {
  if (art === 'start') spiele('abschuss')
  else if (art === 'wasser') spiele('platsch')
  else if (art === 'treffer') {
    spiele('knall')
    vibriere(60)
  } else {
    spiele('versenkt')
    vibriere([90, 40, 140])
  }
}

export function useSchussFolge({
  sicht,
  schluessel,
  start,
  leinwand,
  zielRef,
  eigenRef,
}: {
  sicht: Sicht | null
  /** Wechselt die Partie oder wer aufs Handy schaut, fängt das Zählen neu an. */
  schluessel: string
  /** Wie viele Schüsse bei einem neuen Schlüssel schon als gezeigt gelten. */
  start: { mein: number; sein: number }
  leinwand: RefObject<HTMLCanvasElement | null>
  zielRef: RefObject<HTMLDivElement | null>
  eigenRef: RefObject<HTMLDivElement | null>
}) {
  const [stand, setStand] = useState<Stand>({ key: schluessel, ...start })
  const [fliegt, setFliegt] = useState(false)
  const [meldung, setMeldung] = useState<Meldung | null>(null)
  const fliegtRef = useRef(false)
  const effekte = useRef<Effekte | null>(null)
  const warte = useRef<Warte | null>(null)
  const sichtRef = useRef(sicht)
  const nr = useRef(0)

  // Bei neuem Schlüssel gilt der Anfangsstand -- bis zur ersten Änderung abgeleitet.
  const aktuell: Stand = stand.key === schluessel ? stand : { key: schluessel, ...start }
  const aktuellRef = useRef(aktuell)
  useEffect(() => {
    aktuellRef.current = aktuell
    sichtRef.current = sicht
  })

  // Die Effekte gehören zu genau einer Leinwand. Wechselt sie (die Seite
  // wurde neu aufgebaut), entstehen sie beim nächsten Schuss neu.
  const effekteLeinwand = useRef<HTMLCanvasElement | null>(null)
  const holeEffekte = useCallback((): Effekte => {
    if (!effekte.current || effekteLeinwand.current !== leinwand.current) {
      effekte.current?.beende()
      effekte.current = erstelleEffekte(leinwand.current)
      effekteLeinwand.current = leinwand.current
    }
    return effekte.current
  }, [leinwand])
  useEffect(
    () => () => {
      effekte.current?.beende()
      effekte.current = null
    },
    [],
  )

  // Den neuen Schlüssel festhalten, damit später ankommende Schüsse fliegen.
  useEffect(() => {
    if (stand.key === schluessel) return
    const uhr = setTimeout(() =>
      setStand((alt) => (alt.key === schluessel ? alt : aktuellRef.current)),
    )
    return () => clearTimeout(uhr)
  }, [stand.key, schluessel])

  // Ein vorab gestarteter Schuss: Kommt er in der Sicht an, ist das Ergebnis da.
  useEffect(() => {
    const w = warte.current
    if (!w || !sicht) return
    const s = sicht.eigeneSchuesse.find((x) => x.feld === w.feld)
    if (s) {
      warte.current = null
      w.loese(s)
    }
  }, [sicht])

  const flieg = useCallback(
    (
      art: 'mein' | 'sein',
      feld: number,
      index: number,
      ergebnis: Schuss | Promise<Schuss | null>,
    ) => {
      const s = sichtRef.current
      if (!s) return
      const fx = holeEffekte()
      const key = aktuellRef.current.key
      fliegtRef.current = true
      setFliegt(true)
      const ziel = art === 'mein' ? zielRef.current : eigenRef.current
      const nach = mitteVon(ziel, feld)
      // Mein Schuss startet von einem meiner Schiffe, die noch schwimmen.
      let von: Punkt = { x: window.innerWidth / 2, y: window.innerHeight + 30 }
      if (art === 'mein') {
        const zeigt = s.gegnerSchuesse.slice(0, aktuellRef.current.sein)
        const schwimmt = s.eigeneFlotte.filter((x) => !istVersenkt(x, zeigt))
        const schiff = schwimmt[(index * 7 + feld) % Math.max(1, schwimmt.length)]
        if (schiff) {
          const fs = felderVon(schiff)
          const m = mitteVon(eigenRef.current, fs[Math.floor(fs.length / 2)]!)
          if (m) von = m.p
        }
      }
      const zaehle = (schuss: Schuss | null) => {
        if (!schuss) return
        setStand((alt) => {
          const basis = alt.key === key ? alt : { ...aktuellRef.current }
          if (basis.key !== key) return alt
          return art === 'mein'
            ? { ...basis, mein: Math.max(basis.mein, index + 1) }
            : { ...basis, sein: Math.max(basis.sein, index + 1) }
        })
        const n = ++nr.current
        setMeldung({
          nr: n,
          brett: art === 'mein' ? 'ziel' : 'eigen',
          ergebnis: schuss.ergebnis,
          feld: schuss.feld,
          schiff: schuss.schiff,
        })
        setTimeout(() => setMeldung((m) => (m?.nr === n ? null : m)), 1500)
      }
      const fertig = () => {
        fliegtRef.current = false
        setFliegt(false)
      }
      if (!nach) {
        // Kein Meer zu sehen (Übergabe, Wechsel): ohne Bild zählen.
        void Promise.resolve(ergebnis).then((e) => {
          zaehle(e)
          fertig()
        })
        return
      }
      const schiffFelder = (schuss: Schuss): Punkt[] => {
        const jetzt = sichtRef.current
        const flotte: readonly Schiff[] =
          art === 'mein' ? (jetzt?.gegnerFlotte ?? []) : (jetzt?.eigeneFlotte ?? [])
        const schiff = flotte.find((x) => x.id === schuss.schiff)
        if (!schiff) return []
        return felderVon(schiff)
          .filter((f) => f !== schuss.feld)
          .map((f) => mitteVon(ziel, f)?.p)
          .filter((p): p is Punkt => !!p)
      }
      void fx
        .feuere({
          von,
          nach: nach.p,
          zelle: nach.zelle,
          ergebnis,
          schiffFelder,
          onEinschlag: zaehle,
          wackeln: ziel,
          vonOben: art === 'sein',
          klang,
        })
        .then(fertig, fertig)
    },
    [zielRef, eigenRef, holeEffekte],
  )

  // Die Warteschlange: Was die Partie weiter ist als das Bild, fliegt.
  useEffect(() => {
    if (!sicht || fliegtRef.current || stand.key !== schluessel) return
    const uhr = setTimeout(() => {
      if (fliegtRef.current) return
      const a = aktuellRef.current
      const s = sichtRef.current
      if (!s) return
      if (s.eigeneSchuesse.length > a.mein) {
        const schuss = s.eigeneSchuesse[a.mein]!
        flieg('mein', schuss.feld, a.mein, schuss)
      } else if (s.gegnerSchuesse.length > a.sein) {
        const schuss = s.gegnerSchuesse[a.sein]!
        flieg('sein', schuss.feld, a.sein, schuss)
      }
    })
    return () => clearTimeout(uhr)
  }, [sicht, stand, schluessel, fliegt, flieg])

  /**
   * Online: die eigene Rakete starten, bevor der Server geantwortet hat.
   * false, wenn gerade nichts starten darf.
   */
  const vorab = useCallback(
    (feld: number): boolean => {
      const s = sichtRef.current
      const a = aktuellRef.current
      if (!s || fliegtRef.current || s.eigeneSchuesse.length !== a.mein) return false
      const ergebnis = new Promise<Schuss | null>((loese) => {
        warte.current = { feld, loese }
      })
      flieg('mein', feld, a.mein, ergebnis)
      return true
    },
    [flieg],
  )

  /** Der vorab gestartete Schuss kam nicht an: Die Rakete verpufft. */
  const abbrechen = useCallback(() => {
    const w = warte.current
    warte.current = null
    w?.loese(null)
  }, [])

  const nachgezogen =
    !!sicht &&
    sicht.eigeneSchuesse.length <= aktuell.mein &&
    sicht.gegnerSchuesse.length <= aktuell.sein

  return {
    mein: aktuell.mein,
    sein: aktuell.sein,
    fliegt,
    /** Das Bild ist auf dem Stand der Partie, und keine Rakete ist unterwegs. */
    ruhig: nachgezogen && !fliegt,
    meldung,
    vorab,
    abbrechen,
  }
}

/** Die Sicht, wie sie gerade zu sehen ist: nur eingeschlagene Schüsse, nur versenkte fremde Schiffe. */
export function gezeigteSicht(sicht: Sicht, mein: number, sein: number, ruhig: boolean): Sicht {
  const eigeneSchuesse = sicht.eigeneSchuesse.slice(0, mein)
  const alleOffen = !!sicht.ende && ruhig
  return {
    ...sicht,
    eigeneSchuesse,
    gegnerSchuesse: sicht.gegnerSchuesse.slice(0, sein),
    gegnerFlotte: alleOffen
      ? sicht.gegnerFlotte
      : sicht.gegnerFlotte.filter((s) => istVersenkt(s, eigeneSchuesse)),
  }
}
