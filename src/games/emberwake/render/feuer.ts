import * as THREE from 'three'
import { RAUSCHEN_GLSL } from './rauschen'

/**
 * Flammen aus dem Shader (27.11.2026).
 *
 * Eine Flamme ist hier eine Fläche, die immer zur Kamera schaut. Ihre Form
 * entsteht im Fragment-Shader: ein Tropfen, der nach oben schmal wird, und
 * darin Rauschen, das nach oben wegströmt -- so züngelt sie, ohne dass ein
 * einziger Eckpunkt sich bewegt. Innen weißgelb, außen orange, am Rand
 * dunkelrot; die Farben liegen über 1,0, damit auf HOCH das Leuchten
 * (Bloom) sie aufgreift. Additiv gezeichnet, ohne Tiefe zu schreiben.
 */
export interface Flamme {
  mesh: THREE.Mesh
  /** 0 = erloschen, 1 = volles Feuer. */
  kraft: { value: number }
  zeit: { value: number }
}

export function flamme(breite: number, hoehe: number, versatz: number): Flamme {
  const geo = new THREE.PlaneGeometry(breite, hoehe)
  geo.translate(0, hoehe / 2, 0)
  const kraft = { value: 1 }
  const zeit = { value: 0 }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { kraft, zeit, versatz: { value: versatz } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // Kugel-Billboard um den Fußpunkt: Die Fläche liegt immer quer zum Blick.
        vec4 fuss = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 s = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
        fuss.xy += position.xy * s.xy;
        gl_Position = projectionMatrix * fuss;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float kraft;
      uniform float zeit;
      uniform float versatz;
      varying vec2 vUv;
      ${RAUSCHEN_GLSL}
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float t = zeit * 2.4 + versatz;
        // Nach oben strömendes Rauschen, unten fein, oben grob zerrissen.
        float n = ew_fbm(vec2(p.x * 2.2 + versatz, p.y * 2.6 - t));
        float n2 = ew_noise(vec2(p.x * 5.0, p.y * 4.0 - t * 1.7));
        // Tropfenform: unten breit und rund, oben spitz.
        float breite = mix(0.62, 0.06, pow(p.y, 0.7)) * (0.85 + n * 0.35);
        float rand = 1.0 - smoothstep(breite * 0.55, breite, abs(p.x + (n - 0.5) * 0.35 * p.y));
        float oben = 1.0 - smoothstep(0.35, 1.0, p.y + (n2 - 0.5) * 0.35);
        float unten = smoothstep(0.0, 0.16, p.y);
        float f = rand * oben * unten;
        f = smoothstep(0.03, 0.6, f * (0.8 + n * 0.6));
        if (f <= 0.001) discard;
        // Innen heiß und hell, außen kühler.
        vec3 rot = vec3(0.9, 0.18, 0.04);
        vec3 orange = vec3(1.9, 0.75, 0.18);
        vec3 gelb = vec3(2.6, 2.0, 1.0);
        vec3 farbe = mix(rot, orange, smoothstep(0.1, 0.5, f));
        farbe = mix(farbe, gelb, smoothstep(0.55, 0.95, f) * (1.0 - p.y * 0.6));
        gl_FragColor = vec4(farbe * f * kraft, 1.0);
        // Ohne Nachbearbeitung (NIEDRIG, MITTEL) geht das Bild direkt auf den
        // Schirm -- dann muss die Flamme selbst nach sRGB, sonst bleibt sie fahl.
        #include <colorspace_fragment>
      }
    `,
  })
  mat.toneMapped = false
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 6
  return { mesh, kraft, zeit }
}
