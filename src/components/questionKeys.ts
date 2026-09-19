// Keyboard shortcuts for a question: the keys 1 to 9 pick an option, and Enter submits or continues.
// A shortcut must never fight the control that has focus, so this decides which key presses count.

/** Controls the reader types into: digits and Enter belong to them. */
export const TEXT_ENTRY =
  'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="radio"], [type="checkbox"], [type="button"], [type="submit"], [type="reset"])'

/** Controls the browser already activates on Enter, so a shortcut would act a second time. */
export const NATIVE_ENTER = 'button, a[href], summary, input[type="button"], input[type="submit"], input[type="reset"]'

export type QuestionKey = { kind: 'option'; index: number } | { kind: 'enter' }

/** The parts of a `KeyboardEvent` that decide the shortcut. */
export interface KeyPress {
  key: string
  repeat: boolean
  isComposing: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: unknown
}

function isWithin(target: unknown, selector: string): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return typeof element?.closest === 'function' && Boolean(element.closest(selector))
}

/**
 * The shortcut a key press stands for, or null when it isn't one. Not a shortcut: a repeat from a held key,
 * one during IME composition, one with Ctrl, Cmd or Alt, and any key typed into a text field (the short
 * answer box). Enter is also left to a focused button or link, which the browser activates itself.
 */
export function questionKey(press: KeyPress): QuestionKey | null {
  if (press.repeat || press.isComposing || press.ctrlKey || press.metaKey || press.altKey) return null
  if (isWithin(press.target, TEXT_ENTRY)) return null
  if (/^[1-9]$/.test(press.key)) return { kind: 'option', index: Number(press.key) - 1 }
  if (press.key === 'Enter' && !isWithin(press.target, NATIVE_ENTER)) return { kind: 'enter' }
  return null
}
