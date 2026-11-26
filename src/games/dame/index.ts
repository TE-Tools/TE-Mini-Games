export { dameGame } from './definition'
export {
  STANDARD_REGELN,
  HAUSREGELN,
  REMIS,
  STUFEN,
  WERTE,
  PUNKTE,
  SPEICHER_SCHLUESSEL,
  REGELN_SCHLUESSEL,
  regelnAus,
} from './config'
export type { DameRegeln, DameStufe, StufenWerte } from './config'
export {
  STEIN,
  DAME,
  andere,
  vorzeichen,
  farbeVonFigur,
  reiheVon,
  linieVon,
  istDunkel,
  feldName,
  feldAus,
  grundstellung,
  erlaubteZuege,
  kannSchlagen,
  ziehe,
  kurz,
  findeZug,
  schluessel,
  alsText,
  ausText,
  stellungAus,
  zaehle,
  perft,
} from './brett'
export type { Farbe, Stellung, Zug } from './brett'
export {
  neuePartie,
  zieheIn,
  partieAus,
  beende,
  amZug,
  zuegeJetzt,
  zuegeVon,
  naechsteFelder,
  schlagpflichtig,
} from './partie'
export type { Partie, Ende, EndeArt } from './partie'
export { waehleZug, bewerte } from './ki'
export type { KiAuftrag } from './ki'
export { erstelleRechner } from './rechner'
export type { Rechner } from './rechner'
export { standAus, wendeAn, farbeVon } from './online'
export type { DameAktion, DameEintrag, OnlineStand } from './online'
export { ausgangFuer, partiePunkte, partieXp } from './wertung'
export type { Ausgang, Gegner } from './wertung'
