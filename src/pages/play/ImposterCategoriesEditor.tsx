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
import { useSprache, type Texte } from '@/i18n/sprache'
import { meldungText } from './imposter/imposterText'
import styles from './FindeDenImposterPage.module.css'

interface Props {
  categories: CustomCategory[]
  /** Nach jeder Änderung: die Seite liest die Liste neu ein. */
  onChanged: (cats: CustomCategory[]) => void
  onClose: () => void
}

/**
 * Was zuletzt geklappt hat -- als Art und Werte, nicht als fertiger Satz,
 * damit ein Sprachwechsel die Meldung mitnimmt.
 */
type Info =
  | { art: 'geaendert' | 'angelegt' | 'geloescht'; name: string }
  | { art: 'kopiert' | 'kopierenGingNicht' | 'datei' }
  | { art: 'import'; neu: number; aktualisiert: number; uebersprungen: number }

function infoText(t: Texte, info: Info): string {
  const e = t.imposter.editor
  switch (info.art) {
    case 'geaendert':
      return e.geaendert(info.name)
    case 'angelegt':
      return e.angelegt(info.name)
    case 'geloescht':
      return e.geloescht(info.name)
    case 'kopiert':
      return e.kopiert
    case 'kopierenGingNicht':
      return e.kopierenGingNicht
    case 'datei':
      return e.dateiGespeichert(e.dateiname)
    case 'import': {
      const teile = [e.neu(info.neu), e.aktualisiert(info.aktualisiert)]
      if (info.uebersprungen > 0) teile.push(e.uebersprungen(info.uebersprungen))
      return teile.join(', ')
    }
  }
}

/**
 * Eigene Wortlisten anlegen, ändern, löschen -- und als Datei weitergeben.
 * Die Listen liegen nur auf diesem Gerät; Export und Import sind der Weg
 * aufs zweite Handy.
 */
export function ImposterCategoriesEditor({ categories, onChanged, onClose }: Props) {
  const { t } = useSprache()
  const te = t.imposter.editor
  const [editId, setEditId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [wordsText, setWordsText] = useState('')
  const [importText, setImportText] = useState('')
  const [zeigeImport, setZeigeImport] = useState(false)
  // Meldungen bleiben, wie sie aus dem Spielmodul kommen (deutsch), und
  // werden erst beim Rendern übersetzt.
  const [fehler, setFehler] = useState<string[] | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)

  const wortzahl = parseWords(wordsText).length

  const formularLeeren = () => {
    setEditId(null)
    setLabel('')
    setWordsText('')
  }

  const melden = (nachricht: Info) => {
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
      melden({ art: editId ? 'geaendert' : 'angelegt', name: label })
      formularLeeren()
    } catch (e) {
      setFehler([e instanceof Error ? e.message : te.speichernFehlgeschlagen])
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
    melden({ art: 'geloescht', name: c.label })
  }

  const exportieren = async () => {
    const text = exportCustomCategories()
    try {
      await navigator.clipboard.writeText(text)
      melden({ art: 'kopiert' })
    } catch {
      setImportText(text)
      setZeigeImport(true)
      melden({ art: 'kopierenGingNicht' })
    }
  }

  const alsDatei = () => {
    const blob = new Blob([exportCustomCategories()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = te.dateiname
    a.click()
    URL.revokeObjectURL(url)
    melden({ art: 'datei' })
  }

  const importieren = (text: string) => {
    try {
      const r = importCustomCategories(text)
      onChanged(loadCustomCategories())
      setFehler(r.skipped.length > 0 ? r.skipped : null)
      setInfo({
        art: 'import',
        neu: r.added,
        aktualisiert: r.updated,
        uebersprungen: r.skipped.length,
      })
      setImportText('')
      setZeigeImport(false)
    } catch (e) {
      setFehler([e instanceof Error ? e.message : te.importFehlgeschlagen])
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
        <h2 className={styles.cardTitle}>{t.imposter.eigeneKategorien}</h2>
        <p className={styles.subtitle}>{te.einleitung}</p>

        {categories.length === 0 ? (
          <p className={styles.meta}>{te.keine}</p>
        ) : (
          <ul className={styles.hintList}>
            {categories.map((c) => (
              <li key={c.id}>
                <span>
                  {c.label} <span className={styles.badge}>{te.woerter(c.words.length)}</span>
                </span>
                <span className={styles.row}>
                  <button type="button" className={styles.voteBtn} onClick={() => bearbeiten(c)}>
                    {te.aendern}
                  </button>
                  <button type="button" className={styles.voteBtn} onClick={() => loeschen(c)}>
                    {te.loeschen}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{editId ? te.kategorieAendern : te.neueKategorie}</h2>
        <label className={styles.label}>
          {te.name}
          <input
            className={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder={te.namePlatzhalter}
            autoComplete="off"
          />
        </label>
        <label className={styles.label}>
          {te.woerterLabel}
          <textarea
            className={styles.textarea}
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
            placeholder={te.woerterPlatzhalter}
          />
        </label>
        <p className={styles.meta}>{te.wortzahl(wortzahl, MIN_WORDS)}</p>
        {fehler && (
          <p className={styles.error}>{fehler.map((f) => meldungText(t, f)).join(' · ')}</p>
        )}
        {info && <p className={styles.meta}>{infoText(t, info)}</p>}
        <button
          type="button"
          className={styles.btn}
          disabled={!label.trim() || wortzahl < MIN_WORDS}
          onClick={speichern}
        >
          {editId ? te.speichern : te.anlegen}
        </button>
        {editId && (
          <button type="button" className={styles.btnSecondary} onClick={formularLeeren}>
            {te.abbrechen}
          </button>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{te.weitergeben}</h2>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={categories.length === 0}
            onClick={() => void exportieren()}
          >
            {te.kopieren}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={categories.length === 0}
            onClick={alsDatei}
          >
            {te.alsDatei}
          </button>
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => dateiRef.current?.click()}
          >
            {te.dateiOeffnen}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setZeigeImport((v) => !v)}
          >
            {te.textEinfuegen}
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
              {te.exportierterText}
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
              {te.einlesen}
            </button>
          </>
        )}
      </div>

      <button type="button" className={styles.btnSecondary} onClick={onClose}>
        {te.fertig}
      </button>
    </>
  )
}
