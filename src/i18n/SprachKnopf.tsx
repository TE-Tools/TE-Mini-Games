/**
 * Der Umschalter zwischen Deutsch und Englisch.
 *
 * Zwei Sprachen, ein Knopf: Er zeigt die Sprache, in die er wechselt,
 * nicht die aktuelle. Ein Knopf mit der Aufschrift der Sprache, in der
 * man gerade liest, führt verlässlich zum Fehlklick.
 *
 * Die Beschriftung steht in der jeweils anderen Sprache ("Switch to
 * English", "Auf Deutsch umschalten") -- wer die App nicht lesen kann,
 * soll wenigstens diesen einen Satz verstehen.
 */
import { useSprache } from './sprache'
import styles from './SprachKnopf.module.css'

export function SprachKnopf({ className }: { className?: string }) {
  const { sprache, setzeSprache, t } = useSprache()
  const andere = sprache === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      className={className ? `${styles.knopf} ${className}` : styles.knopf}
      onClick={() => setzeSprache(andere)}
      aria-label={t.sprache.wechselZu}
      title={t.sprache.wechselZu}
      lang={andere}
    >
      <span aria-hidden="true">{andere === 'de' ? 'DE' : 'EN'}</span>
    </button>
  )
}
