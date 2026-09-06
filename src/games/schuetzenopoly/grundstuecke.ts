/**
 * Die 22 kaufbaren Grundstücke.
 *
 * Jedes steht für eine tatsächlich existierende Veranstaltung. Die Angabe
 * unter `fakt` ist recherchiert und nachgeprüft -- welche Quelle wofür
 * herhält, steht in `docs/design/schuetzenopoly/grundstuecke.md`. Nichts
 * hier ist ausgedacht: ein Spiel darf über reale Feste keine Märchen
 * erzählen.
 *
 * Aus dem ursprünglichen Entwurf sind die Ruhrgebietsstädte (Essen,
 * Dortmund, Bochum, Wuppertal, Oberhausen, Duisburg) sowie Bielefeld,
 * Kassel, Würzburg und Augsburg herausgefallen: dort ließ sich kein
 * überregional bedeutendes Schützenfest belegen. An ihre Stelle sind Orte
 * getreten, deren Feste nachweisbar groß oder besonders alt sind -- auch
 * wenn manche davon kleiner sind als eine Großstadt. Beim Schützenwesen
 * sagt die Einwohnerzahl über die Bedeutung des Festes wenig aus.
 */

export type GruppenId =
  | 'niederrhein'
  | 'sauerland'
  | 'westfalen'
  | 'hellweg'
  | 'oldenburg'
  | 'niedersachsen'
  | 'metropolen'
  | 'premium'

export interface GruppeDaten {
  id: GruppenId
  name: string
  /** Farbstreifen auf dem Brett. */
  farbe: string
  /** Kosten je Ausbaustufe für alle Grundstücke der Gruppe. */
  baukosten: number
  /** Die Premium-Gruppe zahlt den höheren Gruppenfaktor. */
  premium?: boolean
}

export const GRUPPEN: readonly GruppeDaten[] = [
  { id: 'niederrhein', name: 'Niederrhein', farbe: '#4ade80', baukosten: 200 },
  { id: 'sauerland', name: 'Sauerland', farbe: '#38bdf8', baukosten: 300 },
  { id: 'westfalen', name: 'Westfalen', farbe: '#f472b6', baukosten: 400 },
  { id: 'hellweg', name: 'Hellweg', farbe: '#fb923c', baukosten: 500 },
  { id: 'oldenburg', name: 'Oldenburger Münsterland', farbe: '#c084fc', baukosten: 700 },
  { id: 'niedersachsen', name: 'Niedersachsen', farbe: '#2dd4bf', baukosten: 900 },
  { id: 'metropolen', name: 'Große Städte', farbe: '#f87171', baukosten: 1200 },
  { id: 'premium', name: 'Königsklasse', farbe: '#f0c84a', baukosten: 1500, premium: true },
] as const

/** Art der Veranstaltung -- die Rheinkirmes ist eben kein Schützenfest. */
export type VeranstaltungsArt = 'schuetzenfest' | 'kirmes' | 'umzug' | 'volksfest'

export interface GrundstueckDaten {
  id: string
  /** Kurzname für das Brett -- auf dem Handy ist wenig Platz. */
  stadt: string
  /** Gebräuchlicher Name der Veranstaltung. */
  veranstaltung: string
  art: VeranstaltungsArt
  gruppe: GruppenId
  preis: number
  /** Gebühr auf Stufe 0. Alles andere rechnet die Engine daraus. */
  grundgebuehr: number
  /** Eine nachgeprüfte Aussage, die im Spiel angezeigt wird. */
  fakt: string
}

export const GRUNDSTUECKE: readonly GrundstueckDaten[] = [
  {
    id: 'kevelaer',
    stadt: 'Kevelaer',
    veranstaltung: 'Schützenfest der St.-Antonius-Schützengilde',
    art: 'schuetzenfest',
    gruppe: 'niederrhein',
    preis: 400,
    grundgebuehr: 30,
    fakt: 'Die St.-Antonius-Schützengilde ist seit dem 16. Jahrhundert urkundlich belegt.',
  },
  {
    id: 'grevenbroich',
    stadt: 'Grevenbroich',
    veranstaltung: 'Grevenbroicher Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'niederrhein',
    preis: 450,
    grundgebuehr: 30,
    fakt: 'In Grevenbroich ziehen die Schützen über zwanzigmal im Jahr durch die Stadt.',
  },
  {
    id: 'krefeld',
    stadt: 'Krefeld',
    veranstaltung: 'Bürgerschützenfest Traar',
    art: 'schuetzenfest',
    gruppe: 'niederrhein',
    preis: 500,
    grundgebuehr: 35,
    fakt: 'Der Bürgerschützenverein Traar von 1850 ist der größte Schützenverein Krefelds.',
  },

  {
    id: 'attendorn',
    stadt: 'Attendorn',
    veranstaltung: 'Attendorner Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'sauerland',
    preis: 650,
    grundgebuehr: 45,
    fakt: 'Attendorn feiert am ersten Juliwochenende; die Stadt erhielt 1222 die Stadtrechte.',
  },
  {
    id: 'iserlohn',
    stadt: 'Iserlohn',
    veranstaltung: 'Iserlohner Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'sauerland',
    preis: 700,
    grundgebuehr: 50,
    fakt: 'Mit rund 40.000 Besuchern eines der größten Schützenfeste im Sauerland.',
  },
  {
    id: 'olpe',
    stadt: 'Olpe',
    veranstaltung: 'Olper Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'sauerland',
    preis: 750,
    grundgebuehr: 55,
    fakt: 'Das größte Schützenfest im Südsauerland; die Bruderschaft führt sich auf 1311 zurück.',
  },

  {
    id: 'sassenberg',
    stadt: 'Sassenberg',
    veranstaltung: 'Sassenberger Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'westfalen',
    preis: 900,
    grundgebuehr: 65,
    fakt: 'Das größte Schützenfest im Münsterland – über 1.000 Teilnehmer im Umzug.',
  },
  {
    id: 'recklinghausen',
    stadt: 'Recklinghausen',
    veranstaltung: 'Schützenfest der Alten Bürgerschützengilde',
    art: 'schuetzenfest',
    gruppe: 'westfalen',
    preis: 950,
    grundgebuehr: 70,
    fakt: 'Die Alte Bürgerschützengilde von 1387 ist einer der ältesten Vereine Deutschlands.',
  },
  {
    id: 'werl',
    stadt: 'Werl',
    veranstaltung: 'Werler Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'westfalen',
    preis: 1000,
    grundgebuehr: 75,
    fakt: 'Die St.-Sebastianus-Schützenbruderschaft Werl besteht seit 1494.',
  },

  {
    id: 'soest',
    stadt: 'Soest',
    veranstaltung: 'Soester Bürgerschützenfest',
    art: 'schuetzenfest',
    gruppe: 'hellweg',
    preis: 1150,
    grundgebuehr: 80,
    fakt: 'Gefeiert am Johanni-Wochenende – eines der bekanntesten Feste Westfalens.',
  },
  {
    id: 'paderborn',
    stadt: 'Paderborn',
    veranstaltung: 'Paderborner Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'hellweg',
    preis: 1250,
    grundgebuehr: 90,
    fakt: 'Der Bürgerschützenverein von 1831 zählt zu den größten und ältesten Deutschlands.',
  },

  {
    id: 'cloppenburg',
    stadt: 'Cloppenburg',
    veranstaltung: 'Cloppenburger Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'oldenburg',
    preis: 1400,
    grundgebuehr: 100,
    fakt: 'Eines der bekannten Schützenfeste im Oldenburger Münsterland.',
  },
  {
    id: 'vechta',
    stadt: 'Vechta',
    veranstaltung: 'Vechtaer Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'oldenburg',
    preis: 1450,
    grundgebuehr: 105,
    fakt: 'Der Bürgerschützenverein Vechta hat rund 1.100 Mitglieder in elf Kompanien.',
  },
  {
    id: 'lohne',
    stadt: 'Lohne',
    veranstaltung: 'Lohner Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'oldenburg',
    preis: 1500,
    grundgebuehr: 110,
    fakt: 'Über 2.800 aktive Schützen in 68 Kompanien – das zweitgrößte Fest eines einzelnen Vereins.',
  },

  {
    id: 'celle',
    stadt: 'Celle',
    veranstaltung: 'Celler Schützen- und Volksfest',
    art: 'volksfest',
    gruppe: 'niedersachsen',
    preis: 1700,
    grundgebuehr: 120,
    fakt: 'Eines der ältesten und traditionsreichsten Volksfeste Niedersachsens.',
  },
  {
    id: 'wolfsburg',
    stadt: 'Wolfsburg',
    veranstaltung: 'Wolfsburger Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'niedersachsen',
    preis: 1750,
    grundgebuehr: 125,
    fakt: 'Gilt als größtes Volksfest zwischen Harz und Heide.',
  },
  {
    id: 'peine',
    stadt: 'Peine',
    veranstaltung: 'Peiner Freischießen',
    art: 'volksfest',
    gruppe: 'niedersachsen',
    preis: 1800,
    grundgebuehr: 130,
    fakt: 'Seit über 400 Jahren gefeiert – in Peine heißt es die fünfte Jahreszeit.',
  },

  {
    id: 'moenchengladbach',
    stadt: 'M.gladbach',
    veranstaltung: 'Stadtschützenfest Mönchengladbach',
    art: 'schuetzenfest',
    gruppe: 'metropolen',
    preis: 2100,
    grundgebuehr: 150,
    fakt: 'Der Bezirksverband Mönchengladbach-Rheydt-Korschenbroich vereint 38 Bruderschaften.',
  },
  {
    id: 'muenchen',
    stadt: 'München',
    veranstaltung: 'Trachten- und Schützenzug',
    art: 'umzug',
    gruppe: 'metropolen',
    preis: 2200,
    grundgebuehr: 155,
    fakt: 'Geht auf 1835 zurück; heute ziehen rund 9.000 Teilnehmer durch München.',
  },
  {
    id: 'duesseldorf',
    stadt: 'Düsseldorf',
    veranstaltung: 'Größte Kirmes am Rhein',
    art: 'kirmes',
    gruppe: 'metropolen',
    preis: 2400,
    grundgebuehr: 170,
    fakt: 'Ausgerichtet vom St.-Sebastianus-Schützenverein 1316 – eine Kirmes, kein Schützenfest.',
  },

  {
    id: 'neuss',
    stadt: 'Neuss',
    veranstaltung: 'Neusser Bürger-Schützenfest',
    art: 'schuetzenfest',
    gruppe: 'premium',
    preis: 3000,
    grundgebuehr: 210,
    fakt: 'Das größte Schützenfest der Welt, das ein einzelner Verein ausrichtet – über 7.700 Schützen.',
  },
  {
    id: 'hannover',
    stadt: 'Hannover',
    veranstaltung: 'Schützenfest Hannover',
    art: 'schuetzenfest',
    gruppe: 'premium',
    preis: 3500,
    grundgebuehr: 245,
    fakt: 'Das größte Schützenfest der Welt – seit 1529, mit rund einer Million Besuchern.',
  },
] as const

const NACH_ID = new Map(GRUNDSTUECKE.map((g) => [g.id, g]))
const GRUPPE_NACH_ID = new Map(GRUPPEN.map((g) => [g.id, g]))

export function grundstueck(id: string): GrundstueckDaten | undefined {
  return NACH_ID.get(id)
}

export function gruppe(id: GruppenId): GruppeDaten | undefined {
  return GRUPPE_NACH_ID.get(id)
}

export function grundstueckeDerGruppe(id: GruppenId): GrundstueckDaten[] {
  return GRUNDSTUECKE.filter((g) => g.gruppe === id)
}
