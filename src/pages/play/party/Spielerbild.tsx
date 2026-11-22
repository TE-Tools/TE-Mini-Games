/**
 * Das Bild eines Mitspielers bei der Übergabe: ein farbiger Kreis mit dem
 * Anfangsbuchstaben. Dieselbe Person hat immer dieselbe Farbe -- so sieht
 * man schon von weitem, wem das Handy jetzt gehört, ohne den Namen zu lesen.
 *
 * Bei jedem neuen Namen springt es herein, und ein Ring läuft nach außen:
 * das Zeichen „du bist dran".
 */
import { anfang, farbeFuer } from './spielerFarbe'
import styles from './Spielerbild.module.css'

export function Spielerbild({ name }: { name: string }) {
  const [a, b] = farbeFuer(name)
  return (
    <span
      // Ein neuer Name ist ein neues Element -- so läuft der Auftritt jedes Mal.
      key={name}
      className={styles.bild}
      style={{ background: `linear-gradient(140deg, ${a}, ${b})`, ['--glanz' as string]: a }}
      aria-hidden="true"
    >
      {anfang(name)}
    </span>
  )
}
