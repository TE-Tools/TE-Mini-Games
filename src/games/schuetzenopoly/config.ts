/**
 * Schützenopoly -- alle Balancingwerte an einer Stelle.
 *
 * Nichts in der Engine rechnet mit eingetippten Zahlen. Wer das Spiel
 * schneller, härter oder freundlicher machen will, ändert hier etwas und
 * nirgends sonst -- das war die Bedingung, unter der die Regeln überhaupt
 * anfassbar bleiben.
 */

/** Wie viele Schützenthaler jeder zu Beginn hat. */
export const START_KAPITAL = 10_000

/** Belohnung fürs Überqueren oder Erreichen von START. */
export const START_BONUS = 2_000

/** Anzahl Felder auf dem Brett. */
export const FELDER = 40

/** Positionen der vier Ecken -- die Engine leitet daraus nichts ab, das Brett schon. */
export const ECKE_START = 0
export const ECKE_STRAFBANK = 10
export const ECKE_FREIES_FEST = 20
export const ECKE_ZUR_STRAFBANK = 30

/** Bonus auf dem Freien Fest -- eine Verschnaufpause mit kleiner Belohnung. */
export const FREIES_FEST_BONUS = 500

/**
 * Strafbank. Wer einen Pasch würfelt, kommt sofort frei; sonst nach drei
 * Versuchen gegen Gebühr. Freikaufen geht jederzeit.
 */
export const STRAFBANK_MAX_VERSUCHE = 3
export const STRAFBANK_GEBUEHR = 750

/** Drei Pasch hintereinander -- zu viel Glück wandert auf die Strafbank. */
export const PASCH_BIS_STRAFBANK = 3

/**
 * Ausbaustufen. Index 0 ist das nackte Grundstück, Index 4 das
 * Schützenzentrum. Die Namen stehen nur hier; die vier Sonderfelder tragen
 * bewusst andere Namen, damit "Schützenhalle" im Spiel immer ein Gebäude ist.
 */
export const AUSBAU_NAMEN = [
  'Grundstück',
  'Festzelt',
  'Schützenhalle',
  'Königshaus',
  'Schützenzentrum',
] as const

export type AusbauStufe = 0 | 1 | 2 | 3 | 4
export const MAX_AUSBAU: AusbauStufe = 4

/**
 * Gebühr = Grundgebühr × Ausbaufaktor × Gruppenfaktor.
 *
 * Die Sprünge sind absichtlich steil: ein Königshaus soll den Gegner
 * spürbar treffen, sonst lohnt sich Bauen nicht und die Partie zieht sich.
 *
 * Die Kurve stammt aus 200 durchsimulierten KI-Partien je Variante. Mit
 * flacheren Werten ging in 25 Partien kaum eine Insolvenz durch, das Spiel
 * lief nur auf Punkte hinaus; deutlich steilere Werte machten die Partien
 * dagegen beliebig -- wer zuerst hoch baute, gewann fast immer.
 */
export const AUSBAU_FAKTOR: Record<AusbauStufe, number> = {
  0: 1,
  1: 5,
  2: 13,
  3: 28,
  4: 45,
}

/** Wer eine Gruppe komplett hat, kassiert mehr -- der Anreiz zum Sammeln. */
export const GRUPPEN_FAKTOR = 1.5
/** Die Premium-Gruppe (Neuss und Hannover) noch einmal deutlich mehr. */
export const GRUPPEN_FAKTOR_PREMIUM = 2

/**
 * Bauen darf nur, wer die Gruppe komplett besitzt -- ohne diese Regel
 * gewinnt, wer zufällig früh auf dem teuersten Feld stand.
 */
export const BAUEN_NUR_MIT_KOMPLETTER_GRUPPE = true

/** Gleichmäßig ausbauen: kein Feld darf mehr als eine Stufe vorauseilen. */
export const GLEICHMAESSIG_BAUEN = true

/** Rückkauf beim Verkauf von Gebäuden und Grundstücken (Anteil vom Preis). */
export const VERKAUF_ANTEIL = 0.5

/** Die vier Sonderfelder: Gebühr nach Anzahl im Besitz desselben Spielers. */
export const SONDERFELD_PREIS = 800
export const SONDERFELD_GEBUEHR = [0, 250, 500, 1_000, 2_000] as const

/** Die zwei Verbandsfelder: Würfelsumme mal Faktor. */
export const VERBAND_PREIS = 1_000
export const VERBAND_FAKTOR_EINER = 4
export const VERBAND_FAKTOR_BEIDE = 10

/** Belohnungen der Minispiele nach Medaille. */
export const MINISPIEL_BELOHNUNG = {
  keine: 0,
  bronze: 500,
  silber: 1_500,
  gold: 3_000,
} as const

export type Medaille = keyof typeof MINISPIEL_BELOHNUNG

/**
 * Rundenlimit. Eine Runde ist ein Zug für jeden Spieler. 20 Runden liegen
 * erfahrungsgemäß bei 15--25 Minuten, wenn die KI-Züge zügig laufen.
 */
export const STANDARD_RUNDEN_LIMIT = 20
export const MIN_RUNDEN_LIMIT = 5
export const MAX_RUNDEN_LIMIT = 60

/** Spielerzahl in V1. Die Engine selbst kennt diese Grenze nur hier. */
export const MIN_SPIELER = 2
export const MAX_SPIELER = 4

/** XP für eine beendete Partie -- Sieg zählt mehr, Teilnahme zählt auch. */
export const XP_TEILNAHME = 60
export const XP_SIEG = 140
/** XP je Minispiel-Medaille (bronze, silber, gold). */
export const XP_MINISPIEL: Record<Medaille, number> = {
  keine: 0,
  bronze: 5,
  silber: 12,
  gold: 25,
}

/** Obergrenze der XP aus einer Partie, damit lange Partien nicht ausufern. */
export const XP_MAX_JE_PARTIE = 400
