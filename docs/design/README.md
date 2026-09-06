# TE-Mini Games – Design-Spezifikationen

Verbindliche Gestaltungs- und Umsetzungsvorgaben.

| Thema | Status | Ordner |
|-------|--------|--------|
| **Levelkarte 1–500 („Zeitreise“)** | umgesetzt | [level-map-500/](./level-map-500/) |
| **Schützenopoly** | umgesetzt | [schuetzenopoly/](./schuetzenopoly/) |

## Levelkarte 1–500 (Kurz)

- Vertikale 9:16-Karte, ein schlängelnder Steinpfad von unten (Level 1) nach oben (Level 500)
- Fünf Biome à 100 Level: Urwald → Vulkanland → Felswüste → Eiszeit → Gletschergipfel
- Nahtlose Übergänge, runde Steinplatten als Levelknoten, Eispalast als Finale auf Level 500
- Umsetzung über `src/components/level-map/LevelMap.tsx` (zonenabhängige Optik), nicht als statisches Bild

Details: [`level-map-500/README.md`](./level-map-500/README.md)

## Schützenopoly (Kurz)

- Brettspiel um 22 reale deutsche Schützenfeste, 40 Felder, 2–4 Spieler (Mensch und KI gemischt)
- Regeln liegen vollständig in `src/games/schuetzenopoly/`, die Seite enthält keine
- Alle Balancingwerte in `config.ts`; die KI darf nichts sehen, was ein Mensch nicht sieht
- Die 22 Veranstaltungen sind einzeln recherchiert und belegt

Details: [`schuetzenopoly/README.md`](./schuetzenopoly/README.md) ·
Faktencheck: [`schuetzenopoly/grundstuecke.md`](./schuetzenopoly/grundstuecke.md)
