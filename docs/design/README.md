# TE-Mini Games – Design-Spezifikationen

Verbindliche Gestaltungs- und Umsetzungsvorgaben.

| Thema | Status | Ordner |
|-------|--------|--------|
| **Levelkarte 1–500 („Zeitreise“)** | umgesetzt | [level-map-500/](./level-map-500/) |

## Levelkarte 1–500 (Kurz)

- Vertikale 9:16-Karte, ein schlängelnder Steinpfad von unten (Level 1) nach oben (Level 500)
- Fünf Biome à 100 Level: Urwald → Vulkanland → Felswüste → Eiszeit → Gletschergipfel
- Nahtlose Übergänge, runde Steinplatten als Levelknoten, Eispalast als Finale auf Level 500
- Umsetzung über `src/components/level-map/LevelMap.tsx` (zonenabhängige Optik), nicht als statisches Bild

Details: [`level-map-500/README.md`](./level-map-500/README.md)
