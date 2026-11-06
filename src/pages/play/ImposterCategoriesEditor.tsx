import { useRef, useState } from 'react'
import {
  loadCustomCategories,
  saveCustomCategory,
  deleteCustomCategory,
  exportCustomCategories,
  importCustomCategories,
  parseWords,
  MIN_WORDS,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import styles from './FindeDenImposterPage.module.css'

interface Props {
  categories: CustomCategory[]
  /** Nach jeder Änderung: die Seite liest die Liste neu ein. */
  onChanged: (cats: CustomCategory[]) => void
  onClose: () => void
}

/**
 * Eigene Wortlisten anlegen, ändern, löschen -- und als Datei weitergeben.
 * Die Listen liegen nur auf diesem Gerät; Export und Import sind der Weg
 * aufs zweite Handy.
 */
export function ImposterCategoriesEditor({ categories, onChanged, onClose }: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [wordsText, setWordsText] = useState('')
  const [importText, setImportText] = useState('')
  const [zeigeImport, setZeigeImport] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)

  const wortzahl = parseWords(wordsText).length

  const formularLeeren = () => {
    setEditId(null)
    setLabel('')
    setWordsText('')
  }

  const melden = (nachricht: string) => {
    setInfo(nachricht)
    setFehler(null)
  }

  const speichern = () => {
    try {
      saveCustomCategory({
        id: editId ?? undefined,
        label,
        words: parseWords(wordsText),
      })
      onChanged(loadCustomCategories())
      melden(editId ? `„${label}" geändert` : `„${label}" angelegt`)
      formularLeeren()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
      setInfo(null)
    }
  }

  const bearbeiten = (c: CustomCategory) => {
    setEditId(c.id)
    setLabel(c.label)
    setWordsText(c.words.join('\n'))
    setFehler(null)
    setInfo(null)
  }

  const loeschen = (c: CustomCategory) => {
    deleteCustomCategory(c.id)
    onChanged(loadCustomCategories())
    if (editId === c.id) formularLeeren()
    melden(`„${c.label}" gelöscht`)
  }

  const exportieren = async () => {
    const text = exportCustomCategories()
    try {
      await navigator.clipboard.writeText(text)
      melden('In die Zwischenablage kopiert – jetzt kannst du sie dir schicken.')
    } catch {
      setImportText(text)
      setZeigeImport(true)
      melden('Kopieren ging nicht – der Text steht jetzt unten zum Markieren.')
    }
  }

  const alsDatei = () => {
    const blob = new Blob([exportCustomCategories()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'imposter-kategorien.json'
    a.click()
    URL.revokeObjectURL(url)
    melden('Datei gespeichert: imposter-kategorien.json')
  }

  const importieren = (text: string) => {
    try {
      const r = importCustomCategories(text)
      onChanged(loadCustomCategories())
      const teile = [`${r.added} neu`, `${r.updated} aktualisiert`]
      if (r.skipped.length > 0) teile.push(`${r.skipped.length} übersprungen`)
      setFehler(r.skipped.length > 0 ? r.skipped.join(' · ') : null)
      setInfo(teile.join(', '))
      setImportText('')
      setZeigeImport(false)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Import fehlgeschlagen')
      setInfo(null)
    }
  }

  const dateiLesen = (datei: File | undefined) => {
    if (!datei) return
    void datei.text().then(importieren)
  }

  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Eigene Kategorien</h2>
        <p className={styles.subtitle}>
          Eigene Wortlisten für die Runde – zum Beispiel Namen aus dem Verein oder Insider aus
          der Familie. Sie liegen nur auf diesem Gerät; zum Weitergeben nimmst du Export und
          Import. Online gehen sie nicht: dort zieht der Server das Wort, und der kennt nur
          den eingebauten Wortschatz.
        </p>

        {categories.length === 0 ? (
          <p className={styles.meta}>Noch keine eigene Kategorie.</p>
        ) : (
          <ul className={styles.hintList}>
            {categories.map((c) => (
              <li key={c.id}>
                <span>
                  {c.label} <span className={styles.badge}>{c.words.length} Wörter</span>
                </span>
                <span className={styles.row}>
                  <button type="button" className={styles.voteBtn} onClick={() => bearbeiten(c)}>
                    Ändern
                  </button>
                  <button type="button" className={styles.voteBtn} onClick={() => loeschen(c)}>
                    Löschen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{editId ? 'Kategorie ändern' : 'Neue Kategorie'}</h2>
        <label className={styles.label}>
          Name
          <input
            className={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="z. B. Schützenverein"
            autoComplete="off"
          />
        </label>
        <label className={styles.label}>
          Wörter (eine Zeile pro Wort)
          <textarea
            className={styles.textarea}
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
            placeholder={'Königsschuss\nVogelstange\nFahnenträger\n…'}
          />
        </label>
        <p className={styles.meta}>
          {wortzahl} Wörter · mindestens {MIN_WORDS} nötig
        </p>
        {fehler && <p className={styles.error}>{fehler}</p>}
        {info && <p className={styles.meta}>{info}</p>}
        <button
          type="button"
          className={styles.btn}
          disabled={!label.trim() || wortzahl < MIN_WORDS}
          onClick={speichern}
        >
          {editId ? 'Änderung speichern' : 'Kategorie anlegen'}
        </button>
        {editId && (
          <button type="button" className={styles.btnSecondary} onClick={formularLeeren}>
            Abbrechen
          </button>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Weitergeben</h2>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={categories.length === 0}
            onClick={() => void exportieren()}
          >
            Kopieren
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={categories.length === 0}
            onClick={alsDatei}
          >
            Als Datei
          </button>
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => dateiRef.current?.click()}
          >
            Datei öffnen
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setZeigeImport((v) => !v)}
          >
            Text einfügen
          </button>
        </div>
        <input
          ref={dateiRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => dateiLesen(e.target.files?.[0])}
        />
        {zeigeImport && (
          <>
            <label className={styles.label}>
              Exportierter Text
              <textarea
                className={styles.textarea}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{ "format": "te-mini-games/…", "categories": [ … ] }'
              />
            </label>
            <button
              type="button"
              className={styles.btn}
              disabled={!importText.trim()}
              onClick={() => importieren(importText)}
            >
              Einlesen
            </button>
          </>
        )}
      </div>

      <button type="button" className={styles.btnSecondary} onClick={onClose}>
        Fertig
      </button>
    </>
  )
}
