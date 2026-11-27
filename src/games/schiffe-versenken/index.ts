export { schiffeVersenkenGame } from './definition'
export {
  GROESSE,
  FLOTTE,
  STANDARD_REGELN,
  HAUSREGELN,
  STUFEN,
  TREFFER_GEWICHT,
  PUNKTE,
  DENKZEIT_MS,
  SPEICHER_SCHLUESSEL,
  REGELN_SCHLUESSEL,
  regelnAus,
} from './config'
export type { SchiffArt, SchiffId, SchiffeRegeln, SchiffeStufe, StufenWerte } from './config'
export {
  feldVon,
  spalteVon,
  reiheVon,
  feldName,
  felderVon,
  platzFehler,
  flottenFehler,
  schiffAuf,
  zufallsFlotte,
  gedreht,
  verschoben,
  flotteAus,
} from './flotte'
export type { Schiff, Richtung, FlottenFehler } from './flotte'
export {
  anderer,
  neuePartie,
  schonBeschossen,
  istVersenkt,
  schiesse,
  gibAuf,
  versenkteSchiffe,
  sichtFuer,
  versenktZahl,
  SCHIFFE_JE_FLOTTE,
  partieAusZuegen,
  feldFolge,
} from './partie'
export type { Spieler, Ergebnis, Schuss, Ende, EndeArt, Partie, Sicht } from './partie'
export { waehleSchuss, wahrscheinlichkeiten } from './ki'
export type { KiLage } from './ki'
export { spielerVonSitz, sichtAus, flotteVomServer } from './online'
export { ausgangFuer, partiePunkte, partieXp } from './wertung'
export type { Ausgang, Gegner } from './wertung'
