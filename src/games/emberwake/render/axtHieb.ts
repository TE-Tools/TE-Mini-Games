/**
 * Der Axthieb als Ablauf (27.11.2026, Thomas: „wenn die Hand sich so
 * komisch dreht").
 *
 * Bis dahin sank der Arm beim Holzhacken über die ganze Sammelzeit
 * gleichmäßig herab und sprang dann in einem Bild wieder nach oben; die Axt
 * hing starr in Verlängerung des Unterarms, ohne Handgelenk. So hackt
 * niemand. Ein Hieb hat vier Teile:
 *
 * 1. **Zurückfedern** nach dem Treffer, kurz.
 * 2. **Ausholen**: Der Arm geht hoch über die Schulter, der Ellbogen knickt,
 *    das Handgelenk kippt nach hinten -- der Axtkopf steht hinter dem Kopf.
 * 3. **Halten**: ein Augenblick oben.
 * 4. **Schlag**: schnell und immer schneller nach vorn unten, der Arm streckt
 *    sich, das Handgelenk schnappt nach vorn. Am Ende (Phase 1) trifft die
 *    Axt -- genau dann fällt beim Hacken das Scheit (InteractionSystem).
 *
 * Rein und ohne Three.js, damit Vitest die Stellungen prüfen kann. Winkel
 * im Bogenmaß um die z-Achse der Figur: negativ heißt nach hinten oben,
 * positiv nach vorn.
 */
export interface ArmStellung {
  schulter: number
  ellbogen: number
  handgelenk: number
  /** Oberkörper: positiv lehnt zurück, negativ beugt vor. */
  rumpf: number
}

const BEREIT: ArmStellung = { schulter: 0.45, ellbogen: 0.35, handgelenk: 0.15, rumpf: 0 }
/*
 * Oben hinter dem Kopf -- als Winkel über vorn gezählt (gut 200°), nicht als
 * −150°. Gemischt wird linear: Mit dem negativen Winkel lief der Arm beim
 * Schlag unten herum, an der Hüfte vorbei, statt über den Kopf nach vorn.
 */
const OBEN: ArmStellung = { schulter: 3.6, ellbogen: 0.75, handgelenk: -0.5, rumpf: 0.08 }
const OBEN_HALT: ArmStellung = { schulter: 3.72, ellbogen: 0.85, handgelenk: -0.62, rumpf: 0.1 }
const TREFFER: ArmStellung = { schulter: 0.85, ellbogen: 0.05, handgelenk: 0.55, rumpf: -0.14 }

/** Phase → Stellung, je Abschnitt mit eigener Beschleunigung. */
const ABSCHNITTE: {
  bis: number
  von: ArmStellung
  nach: ArmStellung
  kurve: (t: number) => number
}[] = [
  { bis: 0.12, von: TREFFER, nach: BEREIT, kurve: (t) => 1 - (1 - t) * (1 - t) },
  { bis: 0.6, von: BEREIT, nach: OBEN, kurve: (t) => t * t * (3 - 2 * t) },
  { bis: 0.74, von: OBEN, nach: OBEN_HALT, kurve: (t) => t },
  { bis: 1, von: OBEN_HALT, nach: TREFFER, kurve: (t) => t * t * t },
]

function mische(a: ArmStellung, b: ArmStellung, t: number): ArmStellung {
  return {
    schulter: a.schulter + (b.schulter - a.schulter) * t,
    ellbogen: a.ellbogen + (b.ellbogen - a.ellbogen) * t,
    handgelenk: a.handgelenk + (b.handgelenk - a.handgelenk) * t,
    rumpf: a.rumpf + (b.rumpf - a.rumpf) * t,
  }
}

/** Stellung zur Phase 0..1 eines Hiebs; bei 1 trifft die Axt. */
export function axtStellung(phase: number): ArmStellung {
  const p = Math.min(1, Math.max(0, phase))
  let start = 0
  for (const a of ABSCHNITTE) {
    if (p <= a.bis) return mische(a.von, a.nach, a.kurve((p - start) / (a.bis - start)))
    start = a.bis
  }
  return { ...TREFFER }
}

/**
 * Ein Schlag im Kampf: `attackAnim` fällt in einer Viertelsekunde von 1 auf
 * 0, und getroffen wird sofort. Darum beginnt er fast oben, schlägt im
 * ersten Drittel durch und federt im Rest zurück.
 */
export function kampfStellung(attackAnim: number): ArmStellung {
  const u = 1 - Math.min(1, Math.max(0, attackAnim))
  if (u < 0.35) return axtStellung(0.66 + (u / 0.35) * 0.34)
  return axtStellung(((u - 0.35) / 0.65) * 0.12)
}

export const AXT_BEREIT: Readonly<ArmStellung> = BEREIT
