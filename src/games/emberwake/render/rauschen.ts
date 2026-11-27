/**
 * Rauschen im Shader -- die Grundlage für alles, was nach Natur aussehen
 * soll, ohne dass eine Bilddatei geladen wird (PERFORMANCE.md §3.1).
 *
 * Boden, Rinde, Fels und Flammen bekommen ihre Struktur hier pro Pixel aus
 * der Weltposition: Nichts wiederholt sich wie eine Kachel, und es kostet
 * keinen Speicher. `ew_fbm` legt vier Lagen übereinander -- grob für Flecken,
 * fein für Körnung.
 */
export const RAUSCHEN_GLSL = /* glsl */ `
float ew_hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ew_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = ew_hash(i);
  float b = ew_hash(i + vec2(1.0, 0.0));
  float c = ew_hash(i + vec2(0.0, 1.0));
  float d = ew_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float ew_fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * ew_noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
`

/**
 * Weltposition als Varying: im Vertex-Shader nach `project_vertex`, mit
 * Instanzmatrix, wo es eine gibt (Bäume und Felsen sind instanziert).
 */
export const WELTPOS_VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
  vEwWelt = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vEwWelt = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`
