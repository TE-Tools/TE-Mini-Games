/**
 * Helfer für die Einstellungen der Partyspiele (src/components/party):
 * Mitspieler als Kärtchen statt Textfeld, Kategorie als Blatt statt <select>.
 * Alles synchron über fireEvent, damit es in jedem Test passt.
 */
import { fireEvent, screen, within } from '@testing-library/react'

/** Das Feld für neue Namen. */
export function namensFeld(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /Neuer Name|New name/ }) as HTMLInputElement
}

/** Tippt einen oder mehrere Namen („Anna, Ben") ein und schickt ab -- wie Enter. */
export function namenTippen(text: string) {
  const feld = namensFeld()
  fireEvent.change(feld, { target: { value: text } })
  fireEvent.submit(feld.closest('form')!)
}

/** Die Namen auf den Kärtchen, in der Reihenfolge. */
export function kaertchen(): string[] {
  const liste = screen.getByRole('list', { name: /^(Mitspieler|Players)$/ })
  return within(liste)
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('span:nth-child(2)')!.textContent ?? '')
}

/** Nimmt alle heraus und setzt genau diese Runde. */
export function spielerSetzen(namen: readonly string[]) {
  for (const knopf of screen.queryAllByRole('button', { name: /entfernen$|^Remove / })) {
    fireEvent.click(knopf)
  }
  if (namen.length > 0) namenTippen(namen.join(', '))
}

/** Der Knopf, der das Kategorie-Blatt öffnet. */
export function kategorieKnopf(): HTMLButtonElement {
  const knopf = document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
  if (!knopf) throw new Error('keine Kategorie-Auswahl')
  return knopf
}

/** Die gewählte Kategorie (Kennung). */
export function kategorieWert(): string {
  return kategorieKnopf().getAttribute('data-wert') ?? ''
}

/** Öffnet das Blatt, liest alle angebotenen Kategorien und schließt es wieder. */
export function angeboteneKategorien(): { id: string; name: string }[] {
  fireEvent.click(kategorieKnopf())
  const blatt = screen.getByRole('dialog')
  const liste = within(blatt)
    .getAllByRole('radio')
    .map((r) => {
      // Ohne das Bild (aria-hidden) -- nur der Name der Kategorie.
      const kopie = r.cloneNode(true) as HTMLElement
      kopie.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
      return { id: r.getAttribute('data-wert') ?? '', name: (kopie.textContent ?? '').trim() }
    })
  fireEvent.keyDown(blatt, { key: 'Escape' })
  return liste
}

/** Wählt eine Kategorie im Blatt -- das Blatt schließt sich dabei. */
export function waehleKategorie(id: string) {
  fireEvent.click(kategorieKnopf())
  const radio = within(screen.getByRole('dialog'))
    .getAllByRole('radio')
    .find((r) => r.getAttribute('data-wert') === id)
  if (!radio) throw new Error(`Kategorie ${id} nicht angeboten`)
  fireEvent.click(radio)
}
