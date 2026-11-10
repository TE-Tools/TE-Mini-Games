/**
 * Rückwärts – Mikrofon und Lautsprecher.
 *
 * Der einzige Teil des Spiels, der den Browser braucht. Die Regeln in
 * engine.ts kennen nur Zahlenreihen; hier entstehen sie und hier werden
 * sie hörbar.
 *
 * **Warum kein MediaRecorder:** Der schreibt eine Datei (WebM oder MP4) in
 * einen Blob, und wo der Browser einen Blob ablegt, entscheidet er selbst
 * -- bei Chrome kann das die Festplatte sein. Zugesagt ist aber, dass eine
 * Aufnahme den Arbeitsspeicher nie verlässt. Deshalb greift das Spiel die
 * rohen Ausschläge ab: Sie liegen in Float32Arrays, die diesem Code
 * gehören, und die er überschreiben kann. Umdrehen lässt sich so eine
 * Reihe außerdem ohne Umweg über einen Decoder.
 *
 * **Zwei Wege zum selben Ergebnis:** ein AudioWorklet, wo es das gibt, und
 * sonst der ältere ScriptProcessor. Beide liefern dieselben Stücke an
 * dieselbe Sammelstelle.
 *
 * Wer hier etwas ändert, lässt drei Dinge stehen: Das Mikrofon wird mit
 * dem Stopp freigegeben (nicht erst beim Verlassen der Seite), nichts wird
 * gespeichert oder verschickt, und jede Kopie einer Aufnahme wird
 * überschrieben, sobald sie nicht mehr gebraucht wird -- auch die im
 * Lautsprecherpuffer. Die Datenschutzerklärung sagt genau das zu.
 */

import type { Klang } from './engine'

/** Warum nicht aufgenommen werden kann. Als Kennung; der Satz steht im Wörterbuch. */
export type TonMangel = 'nicht-unterstuetzt' | 'verweigert' | 'kein-mikrofon' | 'unbekannt'

export class TonFehler extends Error {
  readonly grund: TonMangel
  constructor(grund: TonMangel) {
    super(`Ton: ${grund}`)
    this.name = 'TonFehler'
    this.grund = grund
  }
}

export interface LaufendeAufnahme {
  /** Beendet die Aufnahme, gibt das Mikrofon frei und liefert, was aufgenommen wurde. */
  stopp(): Klang
  /** Beendet ohne Ergebnis. Was schon aufgenommen war, wird überschrieben. */
  abbrechen(): void
}

export interface Wiedergabe {
  /** Erfüllt sich, wenn der Klang zu Ende ist oder angehalten wurde. */
  fertig: Promise<void>
  stopp(): void
}

export interface Tonanlage {
  /**
   * Beginnt eine Aufnahme. Muss aus einem Klick heraus aufgerufen werden:
   * Der Tonkontext darf nur in einer Geste entstehen, sonst bleibt er auf
   * iOS stumm. `beiVoll` meldet, dass die Höchstlänge erreicht ist --
   * aufgenommen wird dann nichts mehr, beendet wird mit `stopp()`.
   * `beiPegel` bekommt etwa fünfzehnmal in der Sekunde, wie laut es gerade
   * ist (quadratischer Mittelwert) -- für die Anzeige, an der man sieht,
   * ob das Mikrofon einen hört.
   */
  nimmAuf(optionen: {
    maxSekunden: number
    beiVoll: () => void
    beiPegel?: (rms: number) => void
  }): Promise<LaufendeAufnahme>
  /** Spielt einen Klang ab. Eine laufende Wiedergabe wird dafür angehalten. */
  spiele(klang: Klang): Wiedergabe
  /** Hält alles an und gibt den Tonkontext frei. */
  schliessen(): void
}

/**
 * Der Mitschnitt im Tonfaden. Als Text, damit er ohne eigene Datei
 * auskommt: Ein Worklet lädt sein Modul über eine Adresse, und eine
 * Blob-Adresse ist offline genauso da wie online.
 */
const MITSCHNITT = `
class TeMitschnitt extends AudioWorkletProcessor {
  constructor() {
    super()
    this.aus = false
    this.port.onmessage = () => { this.aus = true }
  }
  process(inputs) {
    if (this.aus) return false
    const kanal = inputs[0] && inputs[0][0]
    if (kanal && kanal.length > 0) this.port.postMessage(kanal.slice(0))
    return true
  }
}
registerProcessor('te-mitschnitt', TeMitschnitt)
`

type KontextKlasse = typeof AudioContext

function kontextKlasse(): KontextKlasse | undefined {
  const w = window as unknown as {
    AudioContext?: KontextKlasse
    webkitAudioContext?: KontextKlasse
  }
  return w.AudioContext ?? w.webkitAudioContext
}

function mangelAus(fehler: unknown): TonMangel {
  const name = fehler instanceof Error ? fehler.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'verweigert'
  }
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError'
  ) {
    return 'kein-mikrofon'
  }
  return 'unbekannt'
}

export function erstelleTonanlage(): Tonanlage {
  let kontext: AudioContext | null = null
  /** Ob das Worklet-Modul geladen ist -- je Kontext einmal gefragt. */
  let mitschnittDa: Promise<boolean> | null = null
  let laufend: Wiedergabe | null = null

  function hole(): AudioContext {
    if (!kontext) {
      const Klasse = kontextKlasse()
      if (!Klasse) throw new TonFehler('nicht-unterstuetzt')
      kontext = new Klasse()
    }
    // Nicht nur 'suspended': Safari kennt dazu 'interrupted'.
    if (kontext.state !== 'running') void kontext.resume()
    return kontext
  }

  function ladeMitschnitt(ctx: AudioContext): Promise<boolean> {
    if (!mitschnittDa) {
      if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        mitschnittDa = Promise.resolve(false)
      } else {
        const adresse = URL.createObjectURL(
          new Blob([MITSCHNITT], { type: 'application/javascript' }),
        )
        mitschnittDa = ctx.audioWorklet
          .addModule(adresse)
          .then(
            () => true,
            () => false,
          )
          .finally(() => URL.revokeObjectURL(adresse))
      }
    }
    return mitschnittDa
  }

  async function nimmAuf(optionen: {
    maxSekunden: number
    beiVoll: () => void
    beiPegel?: (rms: number) => void
  }): Promise<LaufendeAufnahme> {
    // Zuerst und ohne zu warten: Der Tonkontext muss noch in der Geste
    // entstehen. Nach dem ersten await ist sie vorbei.
    const ctx = hole()
    if (!navigator.mediaDevices?.getUserMedia) throw new TonFehler('nicht-unterstuetzt')
    laufend?.stopp()

    let strom: MediaStream
    try {
      strom = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (fehler) {
      throw new TonFehler(mangelAus(fehler))
    }
    const gibFrei = () => {
      for (const spur of strom.getTracks()) spur.stop()
    }
    // Öffnet sich das Mikrofon, stellt das iPhone seinen Ton um und hält
    // einen laufenden Tonkontext dabei an. Dann käme kein einziger Wert
    // an. Die Geste ist hier vorbei, aber ein Kontext, der in ihr schon
    // einmal lief, lässt sich auch danach wieder anstoßen.
    if (ctx.state !== 'running') {
      try {
        await ctx.resume()
      } catch {
        /* dann zeigt die Pegelanzeige, dass nichts ankommt */
      }
    }

    const stuecke: Float32Array[] = []
    const grenze = Math.round(ctx.sampleRate * optionen.maxSekunden)
    let laenge = 0
    let zu = false
    let vollGemeldet = false
    // Für die Pegelanzeige: Quadrate sammeln, alle 60 ms den Mittelwert melden.
    const pegelBlock = Math.round(ctx.sampleRate * 0.06)
    let quadrate = 0
    let gezaehlt = 0

    const nimm = (stueck: Float32Array) => {
      if (zu || laenge >= grenze) {
        // Kommt nach dem Stopp noch ein Stück an, wird es nicht aufgehoben.
        stueck.fill(0)
        return
      }
      stuecke.push(stueck)
      laenge += stueck.length
      if (optionen.beiPegel) {
        for (let i = 0; i < stueck.length; i++) quadrate += stueck[i]! * stueck[i]!
        gezaehlt += stueck.length
        if (gezaehlt >= pegelBlock) {
          optionen.beiPegel(Math.sqrt(quadrate / gezaehlt))
          quadrate = 0
          gezaehlt = 0
        }
      }
      if (laenge >= grenze && !vollGemeldet) {
        vollGemeldet = true
        optionen.beiVoll()
      }
    }

    let trenne: () => void
    try {
      const mitWorklet = await ladeMitschnitt(ctx)
      const quelle = ctx.createMediaStreamSource(strom)
      // Der Mitschnitt muss am Ausgang hängen, sonst rechnet der Browser
      // ihn nicht. Über einen stummen Regler, damit nichts zu hören ist.
      const stumm = ctx.createGain()
      stumm.gain.value = 0

      let knoten: AudioNode
      let loese: () => void
      if (mitWorklet) {
        const k = new AudioWorkletNode(ctx, 'te-mitschnitt', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: 'explicit',
        })
        k.port.onmessage = (e: MessageEvent<Float32Array>) => nimm(e.data)
        knoten = k
        loese = () => {
          k.port.postMessage('aus')
          k.port.onmessage = null
        }
      } else {
        const k = ctx.createScriptProcessor(4096, 1, 1)
        k.onaudioprocess = (e) => nimm(new Float32Array(e.inputBuffer.getChannelData(0)))
        knoten = k
        loese = () => {
          k.onaudioprocess = null
        }
      }
      quelle.connect(knoten)
      knoten.connect(stumm)
      stumm.connect(ctx.destination)
      trenne = () => {
        loese()
        quelle.disconnect()
        knoten.disconnect()
        stumm.disconnect()
      }
    } catch {
      gibFrei()
      throw new TonFehler('unbekannt')
    }

    const schliesse = () => {
      zu = true
      trenne()
      // Mit dem Stopp ist das Mikrofon frei -- die Anzeige im Browser
      // erlischt jetzt, nicht erst beim Verlassen der Seite.
      gibFrei()
    }
    const verwirf = () => {
      for (const s of stuecke) s.fill(0)
      stuecke.length = 0
    }

    return {
      stopp(): Klang {
        if (!zu) schliesse()
        const samples = new Float32Array(Math.min(laenge, grenze))
        let ab = 0
        for (const s of stuecke) {
          const rest = samples.length - ab
          if (rest <= 0) break
          samples.set(s.length <= rest ? s : s.subarray(0, rest), ab)
          ab += Math.min(s.length, rest)
        }
        // Die Stücke sind jetzt eine zweite Kopie der Stimme.
        verwirf()
        laenge = 0
        return { samples, rate: ctx.sampleRate }
      },
      abbrechen(): void {
        if (!zu) schliesse()
        verwirf()
        laenge = 0
      },
    }
  }

  function spiele(klang: Klang): Wiedergabe {
    const ctx = hole()
    laufend?.stopp()

    const puffer = ctx.createBuffer(1, Math.max(1, klang.samples.length), klang.rate)
    puffer.getChannelData(0).set(klang.samples)
    const quelle = ctx.createBufferSource()
    quelle.buffer = puffer
    quelle.connect(ctx.destination)

    let erledigt = false
    let melde: () => void = () => {}
    const fertig = new Promise<void>((erfuelle) => {
      melde = erfuelle
    })
    const raeume = () => {
      if (erledigt) return
      erledigt = true
      quelle.onended = null
      try {
        quelle.disconnect()
      } catch {
        /* schon getrennt */
      }
      // Auch die Kopie im Lautsprecherpuffer ist eine Aufnahme.
      try {
        puffer.getChannelData(0).fill(0)
      } catch {
        /* Puffer schon abgegeben */
      }
      if (laufend === wiedergabe) laufend = null
      melde()
    }
    const wiedergabe: Wiedergabe = {
      fertig,
      stopp() {
        if (erledigt) return
        try {
          quelle.stop()
        } catch {
          /* lief nicht mehr */
        }
        raeume()
      },
    }
    quelle.onended = raeume
    laufend = wiedergabe
    quelle.start()
    return wiedergabe
  }

  function schliessen(): void {
    laufend?.stopp()
    if (kontext) void kontext.close().catch(() => {})
    kontext = null
    mitschnittDa = null
  }

  return { nimmAuf, spiele, schliessen }
}
