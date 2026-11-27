import * as THREE from 'three'
import { RAUSCHEN_GLSL } from './rauschen'

/**
 * Der Stoff, aus dem die Stillen sind (27.11.2026).
 *
 * Die Stillen sind ehemalige Träger, deren Glut erlosch (data/enemies.ts).
 * Ihr Körper ist deshalb kein Fleisch, sondern Schatten mit dem Rest einer
 * kalten Glut darin:
 *
 * - **Adern**: dünne, pulsierende Risse in der Augenfarbe, im Körper
 *   verankert (lokale Koordinaten) -- sie wandern nicht, wenn er läuft.
 * - **Saum**: Am Umriss leuchtet ein kalter Rand (Fresnel). Nachts liest man
 *   so die Gestalt, obwohl sie fast schwarz ist.
 * - **Fetzen**: Wo die Geometrie `flattern` > 0 trägt (Mantelsäume, Bänder),
 *   wehen die Ecken im Vertex-Shader.
 * - **Auflösen**: Stirbt einer, brennt er von Rissen her weg, mit glühender
 *   Kante -- statt wie bisher einfach durchsichtig zu werden.
 * - **Leiden im Licht** und **Treffer** färben Saum und Adern heiß.
 *
 * Ein Material je Gegner, alle Teile eines Gegners teilen es.
 */
export interface Schatten {
  material: THREE.MeshStandardMaterial
  zeit: { value: number }
  /** 1 = ganz da, 0 = verschwunden (EnemyState.dissolve). */
  aufloesen: { value: number }
  glut: { value: THREE.Color }
  treffer: { value: number }
  leiden: { value: number }
}

export function schattenMaterial(farbe: number, glut: number, riss: number): Schatten {
  const u = {
    zeit: { value: 0 },
    aufloesen: { value: 1 },
    glut: { value: new THREE.Color(glut) },
    treffer: { value: 0 },
    leiden: { value: 0 },
    riss: { value: riss },
  }
  const material = new THREE.MeshStandardMaterial({
    color: farbe,
    roughness: 0.8,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float flattern;
uniform float zeit;
varying vec3 vEwLokal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vEwLokal = position;
{
  float f = flattern;
  float ph = position.y * 4.0 + position.z * 3.0 + position.x * 2.0;
  transformed.x += (sin(zeit * 3.1 + ph) * 0.07 - 0.06) * f;
  transformed.z += sin(zeit * 2.3 + ph * 1.3) * 0.06 * f;
  transformed.y += sin(zeit * 4.2 + ph * 0.7) * 0.025 * f;
}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float zeit;
uniform float aufloesen;
uniform vec3 glut;
uniform float treffer;
uniform float leiden;
uniform float riss;
varying vec3 vEwLokal;
${RAUSCHEN_GLSL}
float ew_kante = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 p = vEwLokal;
  float n = ew_fbm(p.xy * 3.2 + p.z * 2.1 + 3.7);
  float schwelle = aufloesen * 1.06;
  if (n > schwelle) discard;
  ew_kante = smoothstep(schwelle - 0.1, schwelle, n) * step(aufloesen, 0.995);
  // Schatten ist nicht gleichmäßig schwarz: rauchige Schlieren darin.
  diffuseColor.rgb *= 0.65 + ew_fbm(p.xz * 5.0 + p.y * 3.0 + zeit * 0.15) * 0.7;
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 p = vEwLokal;
  vec3 blick = normalize(vViewPosition);
  // Von schräg oben ist fast jede Fläche ein Umriss -- deshalb steil und schwach.
  float saum = pow(1.0 - clamp(abs(dot(normal, blick)), 0.0, 1.0), 5.0);
  // Adern wie Risse in Glut: grobe Stränge aus fbm, dazu feine Verästelungen.
  float r = ew_fbm(p.xy * 4.2 + p.zx * 2.6 + vec2(0.0, zeit * 0.2));
  float r2 = ew_noise(p.yz * 12.0 + p.x * 5.0 + 1.3);
  float ader = (1.0 - smoothstep(0.0, 0.016, abs(r - 0.5)))
    + (1.0 - smoothstep(0.0, 0.035, abs(r2 - 0.5))) * 0.4 * smoothstep(0.42, 0.5, r) * smoothstep(0.58, 0.5, r);
  float puls = 0.65 + 0.35 * sin(zeit * 3.0 + p.y * 4.0);
  vec3 heiss = vec3(1.0, 0.5, 0.25);
  vec3 kalt = mix(glut, heiss, leiden * 0.7);
  totalEmissiveRadiance += kalt * (saum * (0.35 + leiden * 0.6) + ader * riss * puls * (0.8 + leiden * 1.5));
  totalEmissiveRadiance += mix(glut, heiss, 0.5) * ew_kante * 4.0;
  totalEmissiveRadiance += vec3(treffer * 1.2);
}`,
      )
  }
  material.customProgramCacheKey = () => 'ew-schatten'
  return {
    material,
    zeit: u.zeit,
    aufloesen: u.aufloesen,
    glut: u.glut,
    treffer: u.treffer,
    leiden: u.leiden,
  }
}

/** Gibt einer Geometrie das Attribut `flattern` (überall derselbe Wert). */
export function fest(geo: THREE.BufferGeometry, wert = 0): THREE.BufferGeometry {
  const n = geo.attributes.position!.count
  geo.setAttribute('flattern', new THREE.BufferAttribute(new Float32Array(n).fill(wert), 1))
  return geo
}
