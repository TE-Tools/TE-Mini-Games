/**
 * Datenschema — alle Inhaltstypen des Spiels.
 *
 * Level, Gegner, Gebäude und Rezepte sind Daten, kein Code (§43).
 * Die Kernlogik kennt nur diese Typen, nie konkrete Inhalte.
 * Siehe docs/LEVEL_DESIGN.md §1.
 */

// ---------------------------------------------------------------------------
// Gegenstände und Ressourcen
// ---------------------------------------------------------------------------

export type ResourceId =
  | 'wood' // Zunderholz
  | 'stone' // Kernstein
  | 'metal' // Altmetall
  | 'resin' // Harz
  | 'food' // Nahrung
  | 'moss' // Heilmoos
  | 'crystal' // Glutkristall
  | 'artifact' // Artefakt

export type ToolId = 'axe' | 'torch'

export type ItemId = ResourceId | ToolId

export interface ItemDef {
  id: ItemId
  name: string
  /** Gewicht pro Einheit — Ballast-Mechanik (GAME_DESIGN.md §2.2). */
  weight: number
  kind: 'resource' | 'tool'
  description: string
  /** Farbe für Partikel und Icons (hex). */
  color: number
}

export type Stock = Partial<Record<ItemId, number>>
export type ResourceCost = Partial<Record<ResourceId, number>>

// ---------------------------------------------------------------------------
// Gegner — die Stillen
// ---------------------------------------------------------------------------

export type EnemyId = 'schleicher' | 'hetzer' | 'brecher' | 'nachtmahr'

/** Was der Gegner grundsätzlich will. Entspricht den Mustern aus §18. */
export type EnemyIntent =
  | 'nearest' // A — greift an, was am nächsten ist
  | 'player' // B — verfolgt den Spieler
  | 'core' // C — will den Kern, ignoriert den Spieler

export interface EnemyDef {
  id: EnemyId
  name: string
  hp: number
  /** Meter pro Sekunde. Spieler unbeladen: 3,4. */
  speed: number
  damage: number
  attackRange: number
  attackCooldown: number
  radius: number
  /**
   * Ab welcher Lichtstärke (0..1) der Gegner flieht und Lichtschaden nimmt.
   * Niedrig = lichtscheu. Hoch = trotzt dem Licht.
   */
  lightTolerance: number
  /** Ab welcher Distanz zum Ziel der Gegner überhaupt aufnimmt. */
  perceptionRange: number
  intent: EnemyIntent
  /** Löst sich bei Morgengrauen auf. */
  nightOnly: boolean
  color: number
  eyeColor: number
  scale: number
  /** Todesursache aus Spielersicht, z. B. „Ein Hetzer holte dich ein". */
  killVerb: string
  description: string
}

// ---------------------------------------------------------------------------
// Gebäude
// ---------------------------------------------------------------------------

export type BuildingId = 'core' | 'workbench' | 'storage' | 'tower'

export interface BuildingEffects {
  /** Zusätzliche Kern-Kapazität (Prozentpunkte). */
  coreCapacity?: number
  /** Zusätzlicher maximaler Lichtradius in Metern. */
  lightRadius?: number
  /** Zusätzliche Traglast. */
  carryCapacity?: number
  /** Passive Kern-Regeneration pro Sekunde. */
  coreRegen?: number
  towerDamage?: number
  towerRange?: number
}

export interface BuildingLevelDef {
  cost: ResourceCost
  /** Kernenergie, die der Bau kostet (Prozentpunkte). */
  emberCost: number
  description: string
  effects: BuildingEffects
}

export interface BuildingDef {
  id: BuildingId
  name: string
  /** levels[0] = Stufe 1. Der Kern beginnt auf Stufe 1, alles andere auf 0. */
  levels: BuildingLevelDef[]
  description: string
}

// ---------------------------------------------------------------------------
// Rezepte
// ---------------------------------------------------------------------------

export interface RecipeDef {
  id: string
  result: ToolId
  name: string
  cost: ResourceCost
  emberCost: number
  requires: { building: BuildingId; level: number }
  description: string
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn'

export type ObjectiveDef =
  | { kind: 'store_resource'; resource: ResourceId; amount: number; text: string }
  | { kind: 'core_charge'; threshold: number; text: string }
  | { kind: 'survive_nights'; nights: number; text: string }
  | { kind: 'core_never_below'; threshold: number; text: string }
  | { kind: 'time_under'; seconds: number; text: string }
  | { kind: 'craft'; item: ToolId; text: string }
  | { kind: 'build'; building: BuildingId; level: number; text: string }
  | { kind: 'core_undamaged'; text: string }

export interface ResourceCluster {
  resource: ResourceId
  count: number
  /** Abstand vom Lager in Metern, gleichverteilt. */
  minDist: number
  maxDist: number
  /** Einheiten pro Knoten, ganzzahlig gleichverteilt. */
  amount: [number, number]
}

export interface WaveDef {
  /** 1 = erste Nacht. */
  night: number
  /** Sekunden nach Nachtbeginn. */
  delay: number
  enemies: Partial<Record<EnemyId, number>>
}

export type HintTrigger =
  | 'start'
  | 'first_pickup'
  | 'heavy'
  | 'at_core_with_loot'
  | 'core_low'
  | 'dusk'
  | 'enemy_seen'
  | 'workbench_available'

export interface HintDef {
  trigger: HintTrigger
  /** Höchstens fünf Wörter (§49). */
  text: string
}

export interface SecretDef {
  /** Abstand vom Lager, als Anteil des halben Kartenmaßes (0..1). */
  distance: number
  text: string
  reward: Stock
}

export interface LevelDef {
  id: number
  worldId: number
  name: string
  subtitle: string
  seed: number
  /** Interne Bewertung 1–10 (§82). */
  difficulty: number
  /** Erwartete Spieldauer in Sekunden (§83). */
  targetDuration: number

  terrain: {
    /** Kantenlänge in Metern, Lager in der Mitte. */
    size: number
    elevation: number
    treeDensity: number
    rockDensity: number
  }

  camp: {
    /** Gebäude, die in diesem Level gebaut werden dürfen. */
    unlockedBuildings: BuildingId[]
  }

  ember: {
    /** 0..100 Prozentpunkte. */
    startCharge: number
    /** Grundlast pro Sekunde am Lager. */
    drainBase: number
    /** Quadratischer Fernanteil (GAME_DESIGN.md §2.1). */
    drainDistanceFactor: number
    drainRange: number
    /** Prozentpunkte je Zunderholz. */
    regenPerWood: number
    lightRadiusMin: number
    lightRadiusMax: number
  }

  cycle: {
    dayDuration: number
    duskDuration: number
    nightDuration: number
    dawnDuration: number
    /** Wie viele Nächte das Level dauert. 0 = kein Nachteinbruch. */
    nights: number
    startPhase: DayPhase
  }

  visibility: {
    dayRange: number
    nightRange: number
  }

  player: {
    hp: number
    carryCapacity: number
  }

  resources: ResourceCluster[]
  waves: WaveDef[]

  objectives: {
    primary: ObjectiveDef
    secondary: ObjectiveDef
  }

  secret: SecretDef
  hints: HintDef[]

  rewards: {
    resources: ResourceCost
    unlocks: BuildingId[]
  }

  /** Kurze Fundstücke, max. vier Zeilen (§7). */
  lore: string[]
}

// ---------------------------------------------------------------------------
// Welt
// ---------------------------------------------------------------------------

export interface WorldPalette {
  skyDay: number
  skyNight: number
  fogDay: number
  fogNight: number
  ground: number
  groundDark: number
  tree: number
  treeDark: number
  rock: number
}

export interface WorldDef {
  id: number
  name: string
  subtitle: string
  levelIds: number[]
  palette: WorldPalette
}
