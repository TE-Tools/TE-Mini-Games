/**
 * Mühle online: das Zugbuch.
 *
 * Wie bei Schach und Dame hält der Server nur ein Zugbuch: wer mitspielt,
 * wer Weiß hat, die Hausregeln des Tisches und die Aktionen der Reihe
 * nach. Einen Zug anhängen darf nur, wer laut Server dran ist. Ob der Zug
 * nach den Regeln erlaubt ist, prüft jeder Mitspieler selbst, indem er das
 * Buch durch diese Engine spielt -- mit den Regeln, die am Tisch gelten.
 *
 * Ein Zug ist ein ganzer Halbzug samt Schlag (`a1-a4xd7`), ein Eintrag.
 * Darum wechselt die Reihe nach jedem Zug, und der Server muss nicht
 * wissen, ob eine Mühle zu ist.
 *
 * Steht im Buch ein Zug, der nach den Regeln nicht geht, hat der Spieler,
 * der ihn geschickt hat, verloren. Jeder Mitspieler kommt zu demselben
 * Schluss -- sonst bliebe die Partie stehen.
 */

import type { MuehleRegeln } from './config'
import { andere, type Farbe } from './brett'
import { beende, neuePartie, zieheIn, type Partie } from './partie'

export type MuehleAktion =
  | { art: 'zug'; zug: string }
  | { art: 'aufgeben' }
  | { art: 'remis_anbieten' }
  | { art: 'remis_annehmen' }
  | { art: 'remis_ablehnen' }

export interface MuehleEintrag {
  nr: number
  seat: number
  aktion: MuehleAktion
}

export interface OnlineStand {
  partie: Partie
  /** Wer gerade Remis anbietet -- null, wenn niemand. */
  remisAngebot: Farbe | null
}

/** Welche Farbe ein Sitz spielt. Sitze gibt es zwei: 1 und 2. */
export function farbeVon(seat: number, weissSitz: number): Farbe {
  return seat === weissSitz ? 'w' : 'b'
}

/** Eine Aktion anwenden -- oder liegen lassen. */
export function wendeAn(
  stand: OnlineStand,
  eintrag: MuehleEintrag,
  weissSitz: number,
): OnlineStand {
  const { partie, remisAngebot } = stand
  if (partie.ende) return stand
  const farbe = farbeVon(eintrag.seat, weissSitz)
  const a = eintrag.aktion

  switch (a.art) {
    case 'zug': {
      if (partie.stellung.amZug !== farbe) return stand
      const weiter = typeof a.zug === 'string' ? zieheIn(partie, a.zug) : null
      if (!weiter) {
        return {
          partie: beende(partie, { art: 'ungueltiger-zug', sieger: andere(farbe) }),
          remisAngebot: null,
        }
      }
      // Wer zieht, statt auf ein Angebot einzugehen, hat es abgelehnt.
      return {
        partie: weiter,
        remisAngebot: remisAngebot && remisAngebot !== farbe ? null : remisAngebot,
      }
    }
    case 'aufgeben':
      return {
        partie: beende(partie, { art: 'aufgabe', sieger: andere(farbe) }),
        remisAngebot: null,
      }
    case 'remis_anbieten':
      return remisAngebot ? stand : { partie, remisAngebot: farbe }
    case 'remis_ablehnen':
      return remisAngebot && remisAngebot !== farbe ? { partie, remisAngebot: null } : stand
    case 'remis_annehmen':
      return remisAngebot && remisAngebot !== farbe
        ? { partie: beende(partie, { art: 'remis-vereinbart', sieger: null }), remisAngebot: null }
        : stand
    default:
      return stand
  }
}

/** Die Partie aus dem Zugbuch nachspielen -- mit den Regeln des Tisches. */
export function standAus(
  weissSitz: number,
  regeln: MuehleRegeln,
  buch: readonly MuehleEintrag[],
): OnlineStand {
  const geordnet = [...buch].sort((a, b) => a.nr - b.nr)
  return geordnet.reduce((s, e) => wendeAn(s, e, weissSitz), {
    partie: neuePartie(regeln),
    remisAngebot: null,
  } as OnlineStand)
}
