/**
 * Schach online: das Zugbuch.
 *
 * Wie bei Schützenopoly (siehe dort) hält der Server nur ein Zugbuch: wer
 * mitspielt, wer Weiß hat, und die Aktionen der Reihe nach. Einen Zug
 * anhängen darf nur, wer laut Server dran ist. Ob der Zug nach den Regeln
 * erlaubt ist, prüft jeder Mitspieler selbst, indem er das Buch durch
 * diese Engine spielt.
 *
 * Beim Schach passt das noch besser als bei Schützenopoly: Es gibt nichts
 * Verdecktes und keinen Zufall. Den Server-Weg wie bei den Kartenspielen
 * braucht es nur, wo eine Hand geheim bleiben muss.
 *
 * Steht im Buch ein Zug, der nach den Regeln nicht geht, hat der Spieler,
 * der ihn geschickt hat, verloren. Jeder Mitspieler kommt zu demselben
 * Schluss -- sonst bliebe die Partie stehen: Der Server hielte den anderen
 * für am Zug, die Engine noch den, der den unmöglichen Zug geschickt hat.
 */

import { beende, partieAus, zieheIn, type Partie } from './partie'
import type { Farbe } from './stellung'

export type SchachAktion =
  | { art: 'zug'; zug: string }
  | { art: 'aufgeben' }
  | { art: 'remis_anbieten' }
  | { art: 'remis_annehmen' }
  | { art: 'remis_ablehnen' }

export interface SchachEintrag {
  nr: number
  seat: number
  aktion: SchachAktion
}

export interface OnlineStand {
  partie: Partie
  /** Wer gerade Remis anbietet -- null, wenn niemand. */
  remisAngebot: Farbe | null
}

const andere = (f: Farbe): Farbe => (f === 'w' ? 'b' : 'w')

/** Welche Farbe ein Sitz spielt. Sitze gibt es zwei: 1 und 2. */
export function farbeVon(seat: number, weissSitz: number): Farbe {
  return seat === weissSitz ? 'w' : 'b'
}

/** Eine Aktion anwenden -- oder liegen lassen. */
export function wendeAn(
  stand: OnlineStand,
  eintrag: SchachEintrag,
  weissSitz: number,
): OnlineStand {
  const { partie, remisAngebot } = stand
  if (partie.ende) return stand
  const farbe = farbeVon(eintrag.seat, weissSitz)
  const a = eintrag.aktion

  switch (a.art) {
    case 'zug': {
      if (partie.stellung.farbe() !== farbe) return stand
      const weiter = zieheIn(partie, a.zug)
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

/** Die Partie aus dem Zugbuch nachspielen. */
export function standAus(weissSitz: number, buch: readonly SchachEintrag[]): OnlineStand {
  const geordnet = [...buch].sort((a, b) => a.nr - b.nr)
  return geordnet.reduce((s, e) => wendeAn(s, e, weissSitz), {
    partie: partieAus([]),
    remisAngebot: null,
  } as OnlineStand)
}
