/**
 * EMBERWAKE — mobiles 3D-Survival-Spiel als Modul von TE-Mini Games.
 *
 * Die Spielseite (`src/pages/play/EmberwakePage.tsx`) startet `App` in einem
 * eigenen DOM-Wurzelelement; das Spiel bringt HUD, Menüs und Speicherung
 * selbst mit und meldet Levelabschlüsse über `AppOptions.onLevelCompleted`.
 * Bindende Designdokumente: `docs/design/emberwake/`.
 */
export { emberwakeGame, type EmberwakeRoh } from './definition'
export { App, type AppOptions, type LevelOutcome } from './App'
export { LEVELS, getLevel } from './data/levels'
