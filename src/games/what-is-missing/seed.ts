/**
 * Deterministischer Zufall -- liegt seit 02.09.2026 unter src/games/rng.ts,
 * damit ihn alle Spiele teilen. Diese Datei bleibt als Durchreiche stehen,
 * damit der bestehende Code nicht angefasst werden muss.
 */
export { hashSeed, mulberry32, createRng, shuffle, pickN } from '@/games/rng'
