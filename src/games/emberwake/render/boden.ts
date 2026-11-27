import * as THREE from 'three'
import type { QualityTier } from '@/games/emberwake/platform/Capabilities'
import { RAUSCHEN_GLSL, WELTPOS_VERTEX } from './rauschen'

/**
 * Der Waldboden (27.11.2026, Thomas: „viel realistischer").
 *
 * Bis dahin trug der Boden seine Farbe nur an den Ecken des Geländenetzes
 * -- auf 1,4 m eine Farbe, dazwischen glatt verlaufen. Das sah aus wie
 * gefärbter Kunststoff. Jetzt rechnet der Shader pro Pixel aus der
 * Weltposition:
 *
 * - **Flecken**: frisches Gras, trockenes Gras, nackte Erde und dunkles Moos,
 *   fließend ineinander, nie zweimal gleich.
 * - **Körnung**: feines Rauschen in Farbe und Rauheit -- Erde ist stumpf,
 *   Moos noch stumpfer.
 * - **Relief**: Die Normale wird mit dem Gefälle des Rauschens gekippt. Das
 *   Licht der Laterne streift so über Krumen und Halmansätze, obwohl das
 *   Netz flach ist.
 * - **Lagerplatz**: festgetretene Erde mit Kieseln um das Feuer.
 *
 * Die Eckfarben aus `buildTerrain` bleiben als großräumige Tönung (Höhe,
 * Wärme ums Lager). Auf NIEDRIG bleibt es beim alten günstigen Lambert.
 */
export function bodenMaterial(
  tier: QualityTier,
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  if (tier === 'low') {
    return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.95,
    metalness: 0,
  })
  const relief = tier === 'high' ? '1.0' : '0.7'
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEwWelt;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + WELTPOS_VERTEX)

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vEwWelt;
${RAUSCHEN_GLSL}
// Höhe des Kleinreliefs -- dieselbe Funktion für Farbe und Normale.
float ew_relief(vec2 p) {
  return ew_fbm(p * 2.6) * 0.6 + ew_noise(p * 11.0) * 0.4;
}
float ew_rauh = 0.95;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 p = vEwWelt.xz;
  vec3 basis = diffuseColor.rgb;
  float gross = ew_fbm(p * 0.07);
  float mittel = ew_fbm(p * 0.33 + 4.1);
  float fein = ew_noise(p * 7.0);

  vec3 gras = basis * vec3(0.95, 1.08, 0.86);
  vec3 trocken = mix(basis, vec3(0.50, 0.45, 0.28), 0.62);
  vec3 erde = vec3(0.30, 0.23, 0.16);
  vec3 moos = basis * vec3(0.62, 0.80, 0.55);

  vec3 farbe = gras;
  farbe = mix(farbe, trocken, smoothstep(0.50, 0.68, gross) * 0.85);
  farbe = mix(farbe, moos, smoothstep(0.52, 0.30, mittel) * 0.75);
  float erdAnteil = smoothstep(0.60, 0.74, mittel * 0.7 + gross * 0.45);
  farbe = mix(farbe, erde, erdAnteil * 0.8);

  // Der Lagerplatz: festgetreten, mit Kieseln und Asche zum Feuer hin.
  float d = length(p);
  float lager = 1.0 - smoothstep(2.6, 4.6, d + (mittel - 0.5) * 1.6);
  vec3 platz = vec3(0.21, 0.17, 0.12) * (0.85 + mittel * 0.3);
  float kiesel = smoothstep(0.80, 0.9, ew_fbm(p * 6.0 + 2.3));
  platz = mix(platz, vec3(0.30, 0.29, 0.27), kiesel * 0.6);
  platz = mix(platz, vec3(0.12, 0.10, 0.09), 1.0 - smoothstep(0.9, 1.7, d));
  farbe = mix(farbe, platz, lager);

  // Körnung: Krumen und Halme, ein paar Prozent hell und dunkel.
  farbe *= 0.86 + fein * 0.22 + ew_noise(p * 23.0) * 0.08;
  diffuseColor.rgb = farbe;
  ew_rauh = mix(0.9, 1.0, smoothstep(0.3, 0.7, mittel)) - lager * 0.05 + erdAnteil * 0.03;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = ew_rauh;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
{
  // Gefälle des Reliefs in Weltkoordinaten, als Kippung der Normalen.
  vec2 p = vEwWelt.xz;
  float e = 0.06;
  float h0 = ew_relief(p);
  float gx = (ew_relief(p + vec2(e, 0.0)) - h0) / e;
  float gz = (ew_relief(p + vec2(0.0, e)) - h0) / e;
  vec3 kipp = vec3(-gx, 0.0, -gz) * 0.09 * ${relief};
  normal = normalize(normal + (viewMatrix * vec4(kipp, 0.0)).xyz);
}`,
      )
  }
  mat.customProgramCacheKey = () => `ew-boden-${tier}`
  return mat
}
