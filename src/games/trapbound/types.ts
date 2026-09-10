/**
 * TRAPBOUND – ein 2D-Fallen-Jump'n'Run.
 *
 * Die Idee: Ein Level sieht harmlos aus. Start, ein paar Plattformen, eine
 * Tür. Dann bricht der Boden weg, die Decke fällt, die Tür läuft davon. Der
 * Spieler stirbt, weiß aber sofort, warum -- und probiert es gleich noch
 * einmal. Nicht Zufall, sondern Täuschung ist die Schwierigkeit.
 *
 * Aufbau in drei Schichten, damit später Welten und Fallen dazukommen
 * können, ohne die Engine anzufassen:
 *
 *   types.ts    Was ein Level ist (dieses Modul).
 *   physik.ts   Wie sich eine Figur bewegt und woran sie hängenbleibt.
 *   engine.ts   Ein Schritt Spielzeit: Eingabe rein, neuer Stand raus.
 *   fallen.ts   Was die einzelnen Objekte tun.
 *   levels/     Reine Daten. Kein Level steht im Engine-Code.
 *
 * Alle Maße sind virtuelle Einheiten in einem 480x270-Bild (16:9). Die
 * Anzeige skaliert das auf die Fläche, die sie hat -- damit sieht das Spiel
 * auf jedem Gerät gleich aus, und ein Sprung ist überall gleich weit.
 */

/** Die Bildfläche eines Levels in virtuellen Einheiten. */
export const BILD_BREITE = 480
export const BILD_HOEHE = 270

/** Kantenlänge eines Rasterfelds -- Level werden in Feldern gedacht. */
export const FELD = 16

export interface Rechteck {
  x: number
  y: number
  b: number
  h: number
}

/**
 * Was in einem Level stehen kann.
 *
 * Bewusst wenige Typen mit vielen Schaltern statt vieler Sondertypen: Eine
 * Bruchplatte, die nach dem Betreten fällt statt zu verschwinden, ist
 * dieselbe Sache mit einem anderen Haken.
 */
export type ObjektTyp =
  /** Fester Boden, Wand, Decke. Nichts Besonderes. */
  | 'block'
  /** Zerbricht kurz nachdem man darauf steht. */
  | 'bruch'
  /** Fällt herunter, wenn man darauf steht oder ein Auslöser feuert. */
  | 'fall'
  /** Tödlich bei Berührung. */
  | 'stachel'
  /** Tödlich und in Bewegung. */
  | 'saege'
  /** Fester Boden in Bewegung: Aufzug, Schiebewand, Förderband. */
  | 'beweger'
  /** Schleudert nach oben. */
  | 'feder'
  /** Fest, solange sie zu ist. */
  | 'tuer'
  /** Löst aus, wenn man darauf steht. */
  | 'knopf'
  /** Unsichtbarer Bereich, der beim Betreten auslöst. */
  | 'zone'
  /** Versetzt den Spieler an eine andere Stelle. */
  | 'teleport'
  /** Geheimer Sammelgegenstand. */
  | 'kristall'
  /** Das Ziel. */
  | 'ziel'
  /** Nur Beschriftung -- oft ein falscher Hinweis. */
  | 'schild'

/** Was ein Auslöser bewirkt. Aktionen sind der Kitt zwischen den Fallen. */
export interface Aktion {
  tu:
    /** Objekt verschwindet. */
    | 'weg'
    /** Verstecktes Objekt erscheint. */
    | 'zeigen'
    /** Objekt fängt an zu fallen. */
    | 'fallen'
    /** Tür auf. */
    | 'oeffnen'
    /** Tür zu. */
    | 'schliessen'
    /** Beweger loslaufen lassen. */
    | 'los'
    /** Beweger anhalten. */
    | 'stopp'
    /** Schwerkraft umdrehen. */
    | 'schwerkraft'
    /** Links und rechts vertauschen. */
    | 'umkehren'
    /** Sprungkraft ändern (wert = Faktor). */
    | 'sprungkraft'
    /** Den Spieler auf der Stelle töten. */
    | 'toeten'
    /** Bildschirm wackeln. */
    | 'beben'
  /** Kennung des Objekts, auf das die Aktion wirkt. */
  ziel?: string
  /** Zahlenwert, je nach Aktion (Faktor, Richtung, Stärke). */
  wert?: number
  /** Verzögerung in Sekunden. Damit werden aus Aktionen Zeitfallen. */
  nach?: number
}

export interface Weg {
  /** Verschiebung vom Startpunkt aus. */
  dx: number
  dy: number
  /** Sekunden für eine Strecke. */
  dauer: number
  /** Pause an den Enden. */
  warte?: number
  /** Erst loslaufen, wenn ein Auslöser feuert. */
  wartetAufAusloeser?: boolean
  /**
   * Wo im Zyklus die Bewegung beginnt, in Sekunden.
   *
   * Damit lassen sich mehrere Fallen gegeneinander versetzen -- ein Aufzug
   * steht beim Levelstart unten und nicht zufällig irgendwo.
   */
  start?: number
  /** Nur einmal hin, nicht zurück. */
  einweg?: boolean
}

export interface Objekt extends Rechteck {
  typ: ObjektTyp
  /** Kennung, damit Aktionen dieses Objekt treffen können. */
  id?: string
  /** Da, aber unsichtbar und ohne Wirkung, bis 'zeigen' kommt. */
  versteckt?: boolean
  /** Fest, aber unsichtbar -- wird beim ersten Berühren sichtbar. */
  geheim?: boolean
  /**
   * Sieht aus wie ganz gewöhnlicher Boden bzw. wie gar nichts.
   *
   * Ein Bruchboden zeigt sonst Risse und ein Fallblock hängt sichtbar an der
   * Decke -- beides absichtlich, damit man es beim zweiten Mal sehen kann.
   * Ab Level 101 gibt es beides ohne diesen Hinweis: Der Boden gibt nach,
   * ohne dass etwas darauf hindeutete. Fair bleibt das, weil der Neustart
   * eine halbe Sekunde dauert und die Stelle immer dieselbe ist.
   */
  heimlich?: boolean
  /** Bewegung. */
  weg?: Weg
  /** Sekunden, bis eine Bruch- oder Fallplatte nachgibt. */
  verzoegerung?: number
  /** Zielpunkt eines Teleporters. */
  nach?: { x: number; y: number }
  /** Was dieses Objekt auslöst, wenn es berührt/betreten wird. */
  loest?: Aktion[]
  /** Nur beim ersten Mal auslösen. */
  einmal?: boolean
  /** Beim Ziel: Es ist gar keins, sondern tödlich. */
  falle?: boolean
  /** Beim Ziel: Es weicht aus, wenn man nahe kommt. */
  flieht?: { dx: number; dy: number }
  /** Schrift auf einem Schild. */
  text?: string
  /** Förderband: schiebt den Spieler, der darauf steht. */
  schub?: number
  /** Stärke einer Feder (ohne Angabe der Standardwert). */
  kraft?: number
  /** Fallende Blöcke, die den Spieler erschlagen. */
  toedlich?: boolean
}

/**
 * Ein Schritt einer aufgezeichneten Lösung.
 *
 * Bewusst nicht als Folge fester Zeiten, sondern mit Bedingungen: "nach
 * rechts, bis x über 300 ist" bleibt richtig, auch wenn sich die Laufkraft
 * einmal um zehn Prozent ändert. Eine Folge von Sekundenangaben wäre nach
 * jeder Feinjustierung kaputt und würde nur noch scheinbar etwas beweisen.
 */
export interface LoesungsSchritt {
  /** Höchstdauer dieses Schritts in Sekunden (auch die Bedingung braucht ein Ende). */
  dauer?: number
  /** Warten, bis die Figur rechts von dieser Marke steht. */
  bisX?: number
  /** Warten, bis die Figur links von dieser Marke steht. */
  bisXunter?: number
  /** Warten, bis die Figur über dieser Marke ist (kleineres y = weiter oben). */
  bisYunter?: number
  /** Warten, bis die Figur wieder festen Boden unter den Füßen hat. */
  bisBoden?: boolean
  links?: boolean
  rechts?: boolean
  sprung?: boolean
}

export interface LevelDaten {
  nr: number
  welt: number
  abschnitt: number
  name: string
  /** Ein Satz für die Entwicklung: Worin besteht der Trick? */
  idee: string
  breite?: number
  hoehe?: number
  start: { x: number; y: number }
  /** Abweichende Schwerkraft (1 = normal, -1 = kopfüber). */
  schwerkraft?: number
  objekte: Objekt[]
  /**
   * Eine Eingabefolge, die das Level löst.
   *
   * Steht in den Leveldaten, weil sie zum Level gehört: Der Test spielt sie
   * ab und beweist damit, dass das Level zu schaffen ist. Ändert jemand ein
   * Level, fällt der Test -- genau das soll er.
   */
  loesung?: LoesungsSchritt[]
}

export interface Abschnitt {
  nr: number
  name: string
  /** Levelnummern in diesem Abschnitt. */
  level: number[]
}

export interface Welt {
  nr: number
  name: string
  untertitel: string
  /** Farben der Karte und des Spielfelds. */
  palette: {
    hintergrund: string
    ferne: string
    boden: string
    bodenKante: string
    gefahr: string
    akzent: string
  }
  abschnitte: Abschnitt[]
}

/** Eingaben eines Spielzugs. */
export interface Eingabe {
  links: boolean
  rechts: boolean
  sprung: boolean
}

export const LEER_EINGABE: Eingabe = { links: false, rechts: false, sprung: false }
