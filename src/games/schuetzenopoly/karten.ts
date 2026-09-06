/**
 * Die beiden Kartenstapel.
 *
 * EREIGNIS trifft einen sofort und meist im Geldbeutel. VEREINSKARTE ist
 * taktisch: sie wirkt auf spätere Züge, auf Mitspieler oder auf Besitz.
 *
 * Eine Karte beschreibt nur, *was* passieren soll. Wie es passiert, steht
 * in der Engine -- sonst müsste man Regeln an zwei Stellen pflegen.
 */

export type KartenStapel = 'ereignis' | 'verein'

export type KartenWirkung =
  /** Geld von der Bank oder an die Bank. */
  | { art: 'geld'; betrag: number }
  /** Von jedem Mitspieler kassieren (positiv) oder an jeden zahlen (negativ). */
  | { art: 'von_allen'; betrag: number }
  /** Auf ein bestimmtes Feld ziehen; START-Bonus gibt es beim Überqueren. */
  | { art: 'gehe_zu'; position: number }
  /** Direkt auf die Strafbank, ohne START. */
  | { art: 'strafbank' }
  /** Karte behalten: befreit einmalig von der Strafbank. */
  | { art: 'freikarte' }
  /** Je Ausbaustufe im Besitz zahlen -- wer groß gebaut hat, zahlt mehr. */
  | { art: 'reparatur'; jeStufe: number }
  /** Nächste fällige Gebühr entfällt. */
  | { art: 'gebuehr_erlassen' }
  /** Ein Gegner darf bis zu seinem nächsten Zug nicht bauen. */
  | { art: 'baustopp' }
  /** Ein Grundstück gegen ein gleichwertiges tauschen (Auswahl im Spiel). */
  | { art: 'tausch' }
  /** Die nächste negative Ereigniskarte verfällt. */
  | { art: 'schutzschild' }
  /** Ein eigenes Grundstück ist eine Runde lang gebührenfrei für den Besitzer geschützt. */
  | { art: 'grundstueck_schuetzen' }
  /** Ein Minispiel auslösen. */
  | { art: 'minispiel' }

export interface Karte {
  id: string
  stapel: KartenStapel
  titel: string
  icon: string
  text: string
  wirkung: KartenWirkung
}

export const EREIGNISKARTEN: readonly Karte[] = [
  {
    id: 'e_koenig',
    stapel: 'ereignis',
    titel: 'Schützenkönig',
    icon: '👑',
    text: 'Du hast den Vogel abgeschossen und wirst zum Schützenkönig gekrönt.',
    wirkung: { art: 'geld', betrag: 1500 },
  },
  {
    id: 'e_musikzug',
    stapel: 'ereignis',
    titel: 'Musikzug',
    icon: '🎺',
    text: 'Dein Musikzug spielt auf und sorgt für beste Stimmung.',
    wirkung: { art: 'geld', betrag: 750 },
  },
  {
    id: 'e_meisterschuetze',
    stapel: 'ereignis',
    titel: 'Meisterschütze',
    icon: '🎯',
    text: 'Du gewinnst den Wettbewerb auf dem Schießstand.',
    wirkung: { art: 'geld', betrag: 1000 },
  },
  {
    id: 'e_ausverkauft',
    stapel: 'ereignis',
    titel: 'Ausverkauft',
    icon: '🍺',
    text: 'Dein Festzelt ist bis auf den letzten Platz besetzt.',
    wirkung: { art: 'geld', betrag: 1250 },
  },
  {
    id: 'e_wetter',
    stapel: 'ereignis',
    titel: 'Schlechtes Wetter',
    icon: '🌧️',
    text: 'Dauerregen am Festwochenende. Die Hälfte bleibt zu Hause.',
    wirkung: { art: 'geld', betrag: -500 },
  },
  {
    id: 'e_reparatur',
    stapel: 'ereignis',
    titel: 'Reparatur',
    icon: '🔧',
    text: 'Das Dach der Schützenhalle muss gedeckt werden. Je Ausbaustufe 150 Taler.',
    wirkung: { art: 'reparatur', jeStufe: 150 },
  },
  {
    id: 'e_ehrenrunde',
    stapel: 'ereignis',
    titel: 'Ehrenrunde',
    icon: '🥇',
    text: 'Der Verein feiert dich. Jeder Mitspieler gibt 250 Taler aus.',
    wirkung: { art: 'von_allen', betrag: 250 },
  },
  {
    id: 'e_freibier',
    stapel: 'ereignis',
    titel: 'Freibier',
    icon: '🍻',
    text: 'Du gibst eine Runde für das ganze Zelt aus: 300 Taler an jeden Mitspieler.',
    wirkung: { art: 'von_allen', betrag: -300 },
  },
  {
    id: 'e_zum_start',
    stapel: 'ereignis',
    titel: 'Auf zum Festplatz',
    icon: '🏠',
    text: 'Das Fest beginnt von vorn. Gehe auf START.',
    wirkung: { art: 'gehe_zu', position: 0 },
  },
  {
    id: 'e_ordnungsamt',
    stapel: 'ereignis',
    titel: 'Ordnungsamt',
    icon: '🚧',
    text: 'Die Sperrstunde wurde übersehen. Ab auf die Strafbank.',
    wirkung: { art: 'strafbank' },
  },
  {
    id: 'e_standgeld',
    stapel: 'ereignis',
    titel: 'Standgeld',
    icon: '💸',
    text: 'Die Standgebühren für die Kirmes sind fällig.',
    wirkung: { art: 'geld', betrag: -600 },
  },
  {
    id: 'e_schiessstand',
    stapel: 'ereignis',
    titel: 'Am Schießstand',
    icon: '🎯',
    text: 'Der Schießstand ist frei. Zeig, was du kannst.',
    wirkung: { art: 'minispiel' },
  },
  {
    id: 'e_koenigsfahrt',
    stapel: 'ereignis',
    titel: 'Einladung zur Königsfahrt',
    icon: '🚌',
    text: 'Der Bus wartet. Fahre zur Königsfahrt.',
    wirkung: { art: 'gehe_zu', position: 35 },
  },
  {
    id: 'e_spende',
    stapel: 'ereignis',
    titel: 'Spende',
    icon: '🎁',
    text: 'Ein Sponsor unterstützt das Fest.',
    wirkung: { art: 'geld', betrag: 900 },
  },
] as const

export const VEREINSKARTEN: readonly Karte[] = [
  {
    id: 'v_freundschaft',
    stapel: 'verein',
    titel: 'Vereinsfreundschaft',
    icon: '🤝',
    text: 'Man kennt sich. Deine nächste fällige Gebühr entfällt.',
    wirkung: { art: 'gebuehr_erlassen' },
  },
  {
    id: 'v_baustopp',
    stapel: 'verein',
    titel: 'Baustopp',
    icon: '🚧',
    text: 'Ein Gegner deiner Wahl darf bis zu seinem nächsten Zug nicht bauen.',
    wirkung: { art: 'baustopp' },
  },
  {
    id: 'v_zuschuss',
    stapel: 'verein',
    titel: 'Vereinszuschuss',
    icon: '💰',
    text: 'Der Verband bewilligt deinen Antrag.',
    wirkung: { art: 'geld', betrag: 2000 },
  },
  {
    id: 'v_tausch',
    stapel: 'verein',
    titel: 'Grundstückstausch',
    icon: '🔄',
    text: 'Tausche ein Grundstück gegen eines von gleichem Wert.',
    wirkung: { art: 'tausch' },
  },
  {
    id: 'v_vorstand',
    stapel: 'verein',
    titel: 'Vorstandsbeschluss',
    icon: '👔',
    text: 'Der Vorstand hält dir den Rücken frei: Die nächste schlechte Ereigniskarte verfällt.',
    wirkung: { art: 'schutzschild' },
  },
  {
    id: 'v_freikarte',
    stapel: 'verein',
    titel: 'Fürsprache',
    icon: '🎫',
    text: 'Behalte diese Karte. Sie holt dich einmal von der Strafbank.',
    wirkung: { art: 'freikarte' },
  },
  {
    id: 'v_hausrecht',
    stapel: 'verein',
    titel: 'Hausrecht',
    icon: '🛡️',
    text: 'Ein Grundstück deiner Wahl bleibt eine Runde lang vor fremdem Zugriff geschützt.',
    wirkung: { art: 'grundstueck_schuetzen' },
  },
  {
    id: 'v_jubilaeum',
    stapel: 'verein',
    titel: 'Vereinsjubiläum',
    icon: '🎊',
    text: 'Alle feiern mit: Jeder Mitspieler steuert 400 Taler bei.',
    wirkung: { art: 'von_allen', betrag: 400 },
  },
  {
    id: 'v_kassenpruefung',
    stapel: 'verein',
    titel: 'Kassenprüfung',
    icon: '🧾',
    text: 'Die Kassenprüfer finden eine Lücke.',
    wirkung: { art: 'geld', betrag: -800 },
  },
  {
    id: 'v_wettkampf',
    stapel: 'verein',
    titel: 'Vereinswettkampf',
    icon: '🏅',
    text: 'Der Verein schickt dich an den Stand.',
    wirkung: { art: 'minispiel' },
  },
] as const

export const ALLE_KARTEN: readonly Karte[] = [...EREIGNISKARTEN, ...VEREINSKARTEN]

export function karte(id: string): Karte | undefined {
  return ALLE_KARTEN.find((k) => k.id === id)
}

/** Karten, die im Blatt bleiben, bis der Spieler sie einsetzt. */
export function istHandkarte(k: Karte): boolean {
  return (
    k.wirkung.art === 'freikarte' ||
    k.wirkung.art === 'gebuehr_erlassen' ||
    k.wirkung.art === 'schutzschild' ||
    k.wirkung.art === 'grundstueck_schuetzen'
  )
}
