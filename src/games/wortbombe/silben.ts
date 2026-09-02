/**
 * Silben für die Wortbombe.
 *
 * Ausgesucht nach einer Regel: Zu jeder Silbe müssen einem am Tisch in fünf
 * Sekunden mehrere deutsche Wörter einfallen. „QU" oder „YPS" sind deshalb
 * nicht dabei -- daran stirbt die Runde, nicht der Spieler.
 *
 * Die Stufen steuern, wie leicht es fällt: „leicht" sind Silben mit Hunderten
 * von Treffern, „schwer" solche, bei denen man kurz nachdenken muss.
 */

export interface Silbe {
  text: string
  stufe: 'leicht' | 'mittel' | 'schwer'
}

export const SILBEN: Silbe[] = [
  // Leicht -- da fällt jedem sofort etwas ein.
  { text: 'AU', stufe: 'leicht' },
  { text: 'EN', stufe: 'leicht' },
  { text: 'ER', stufe: 'leicht' },
  { text: 'IN', stufe: 'leicht' },
  { text: 'AN', stufe: 'leicht' },
  { text: 'EL', stufe: 'leicht' },
  { text: 'AR', stufe: 'leicht' },
  { text: 'IS', stufe: 'leicht' },
  { text: 'ST', stufe: 'leicht' },
  { text: 'CH', stufe: 'leicht' },
  { text: 'SCH', stufe: 'leicht' },
  { text: 'ND', stufe: 'leicht' },
  { text: 'RE', stufe: 'leicht' },
  { text: 'TE', stufe: 'leicht' },
  { text: 'SE', stufe: 'leicht' },
  { text: 'LE', stufe: 'leicht' },
  { text: 'NE', stufe: 'leicht' },
  { text: 'DE', stufe: 'leicht' },
  { text: 'GE', stufe: 'leicht' },
  { text: 'BE', stufe: 'leicht' },
  { text: 'VER', stufe: 'leicht' },
  { text: 'UNG', stufe: 'leicht' },
  { text: 'LICH', stufe: 'leicht' },
  { text: 'HEIT', stufe: 'leicht' },
  { text: 'KEIT', stufe: 'leicht' },

  // Mittel
  { text: 'ACH', stufe: 'mittel' },
  { text: 'AND', stufe: 'mittel' },
  { text: 'ANG', stufe: 'mittel' },
  { text: 'ART', stufe: 'mittel' },
  { text: 'BAU', stufe: 'mittel' },
  { text: 'BER', stufe: 'mittel' },
  { text: 'BUCH', stufe: 'mittel' },
  { text: 'DER', stufe: 'mittel' },
  { text: 'DORF', stufe: 'mittel' },
  { text: 'EIN', stufe: 'mittel' },
  { text: 'END', stufe: 'mittel' },
  { text: 'ENT', stufe: 'mittel' },
  { text: 'FAHR', stufe: 'mittel' },
  { text: 'FALL', stufe: 'mittel' },
  { text: 'FEST', stufe: 'mittel' },
  { text: 'GAR', stufe: 'mittel' },
  { text: 'GLAS', stufe: 'mittel' },
  { text: 'HAND', stufe: 'mittel' },
  { text: 'HAUS', stufe: 'mittel' },
  { text: 'HOL', stufe: 'mittel' },
  { text: 'ICHT', stufe: 'mittel' },
  { text: 'IEL', stufe: 'mittel' },
  { text: 'ING', stufe: 'mittel' },
  { text: 'ISCH', stufe: 'mittel' },
  { text: 'KOPF', stufe: 'mittel' },
  { text: 'LAND', stufe: 'mittel' },
  { text: 'LEB', stufe: 'mittel' },
  { text: 'LICHT', stufe: 'mittel' },
  { text: 'MANN', stufe: 'mittel' },
  { text: 'MEER', stufe: 'mittel' },
  { text: 'NACHT', stufe: 'mittel' },
  { text: 'OHR', stufe: 'mittel' },
  { text: 'ORT', stufe: 'mittel' },
  { text: 'RAD', stufe: 'mittel' },
  { text: 'RAUM', stufe: 'mittel' },
  { text: 'RECHT', stufe: 'mittel' },
  { text: 'ROT', stufe: 'mittel' },
  { text: 'SAL', stufe: 'mittel' },
  { text: 'SAM', stufe: 'mittel' },
  { text: 'SCHAFT', stufe: 'mittel' },
  { text: 'SPIEL', stufe: 'mittel' },
  { text: 'STADT', stufe: 'mittel' },
  { text: 'STEIN', stufe: 'mittel' },
  { text: 'TAG', stufe: 'mittel' },
  { text: 'TISCH', stufe: 'mittel' },
  { text: 'TRAG', stufe: 'mittel' },
  { text: 'UHR', stufe: 'mittel' },
  { text: 'WAND', stufe: 'mittel' },
  { text: 'WASSER', stufe: 'mittel' },
  { text: 'WEG', stufe: 'mittel' },
  { text: 'WELT', stufe: 'mittel' },
  { text: 'WERK', stufe: 'mittel' },
  { text: 'ZEIT', stufe: 'mittel' },
  { text: 'ZUG', stufe: 'mittel' },

  // Schwer -- da muss man kurz überlegen.
  { text: 'AMP', stufe: 'schwer' },
  { text: 'ARZT', stufe: 'schwer' },
  { text: 'BLITZ', stufe: 'schwer' },
  { text: 'BRUCH', stufe: 'schwer' },
  { text: 'DRUCK', stufe: 'schwer' },
  { text: 'FLUG', stufe: 'schwer' },
  { text: 'FROST', stufe: 'schwer' },
  { text: 'GIPS', stufe: 'schwer' },
  { text: 'GOLD', stufe: 'schwer' },
  { text: 'GRUND', stufe: 'schwer' },
  { text: 'HERBST', stufe: 'schwer' },
  { text: 'KLANG', stufe: 'schwer' },
  { text: 'KNOPF', stufe: 'schwer' },
  { text: 'KRAFT', stufe: 'schwer' },
  { text: 'KREUZ', stufe: 'schwer' },
  { text: 'MILCH', stufe: 'schwer' },
  { text: 'MOND', stufe: 'schwer' },
  { text: 'NUSS', stufe: 'schwer' },
  { text: 'PFLANZ', stufe: 'schwer' },
  { text: 'PILZ', stufe: 'schwer' },
  { text: 'SALZ', stufe: 'schwer' },
  { text: 'SCHNEE', stufe: 'schwer' },
  { text: 'SCHRANK', stufe: 'schwer' },
  { text: 'SPRUNG', stufe: 'schwer' },
  { text: 'STRAND', stufe: 'schwer' },
  { text: 'STURM', stufe: 'schwer' },
  { text: 'TRAUM', stufe: 'schwer' },
  { text: 'WOLKE', stufe: 'schwer' },
  { text: 'ZAHN', stufe: 'schwer' },
  { text: 'ZWERG', stufe: 'schwer' },
]

export type SilbenStufe = Silbe['stufe']

export function silbenFuer(stufen: SilbenStufe[]): Silbe[] {
  const erlaubt = stufen.length > 0 ? stufen : (['leicht', 'mittel'] as SilbenStufe[])
  return SILBEN.filter((s) => erlaubt.includes(s.stufe))
}
