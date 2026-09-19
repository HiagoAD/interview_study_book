import { describe, expect, test } from 'vitest'
import { NATIVE_ENTER, TEXT_ENTRY, questionKey } from './questionKeys'
import type { KeyPress } from './questionKeys'

type Kind = 'body' | 'text' | 'button' | 'radio'

/** A target that answers `closest` the way the element of that kind would for the two selectors. */
function target(kind: Kind) {
  return {
    closest: (selector: string) => {
      if (selector === TEXT_ENTRY) return kind === 'text' ? {} : null
      if (selector === NATIVE_ENTER) return kind === 'button' ? {} : null
      return null
    },
  }
}

function press(key: string, over: Partial<KeyPress> & { on?: Kind } = {}): KeyPress {
  const { on = 'body', ...rest } = over
  return { key, repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, target: target(on), ...rest }
}

describe('questionKey', () => {
  test('the keys 1 to 9 pick the option at that position, counting from 0', () => {
    for (let digit = 1; digit <= 9; digit++) {
      expect(questionKey(press(String(digit)))).toEqual({ kind: 'option', index: digit - 1 })
    }
  })

  test('0 and other keys are not shortcuts', () => {
    for (const key of ['0', 'a', ' ', 'Escape', 'ArrowDown', 'Tab', '!', '10']) expect(questionKey(press(key))).toBeNull()
  })

  test('Enter is the enter shortcut', () => {
    expect(questionKey(press('Enter'))).toEqual({ kind: 'enter' })
  })

  test('digits and Enter still count when a radio button or a checkbox has focus', () => {
    expect(questionKey(press('2', { on: 'radio' }))).toEqual({ kind: 'option', index: 1 })
    expect(questionKey(press('Enter', { on: 'radio' }))).toEqual({ kind: 'enter' })
  })

  test('nothing counts while the reader types in a text field', () => {
    expect(questionKey(press('1', { on: 'text' }))).toBeNull()
    expect(questionKey(press('Enter', { on: 'text' }))).toBeNull()
  })

  test('Enter is left to a focused button or link, but a digit still picks an option', () => {
    expect(questionKey(press('Enter', { on: 'button' }))).toBeNull()
    expect(questionKey(press('3', { on: 'button' }))).toEqual({ kind: 'option', index: 2 })
  })

  test('a held key does not repeat the shortcut', () => {
    expect(questionKey(press('1', { repeat: true }))).toBeNull()
    expect(questionKey(press('Enter', { repeat: true }))).toBeNull()
  })

  test('a key that confirms text being composed is not a shortcut', () => {
    expect(questionKey(press('Enter', { isComposing: true }))).toBeNull()
    expect(questionKey(press('1', { isComposing: true }))).toBeNull()
  })

  test('a key with Ctrl, Cmd or Alt is left to the browser', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(questionKey(press('1', { [modifier]: true }))).toBeNull()
      expect(questionKey(press('Enter', { [modifier]: true }))).toBeNull()
    }
  })

  test('works when the target is missing or is not an element', () => {
    expect(questionKey({ ...press('1'), target: null })).toEqual({ kind: 'option', index: 0 })
    expect(questionKey({ ...press('Enter'), target: {} })).toEqual({ kind: 'enter' })
  })
})
