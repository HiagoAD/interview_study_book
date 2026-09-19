import { describe, expect, test } from 'vitest'
import { gradeChoice, gradeShort, gradeTrueFalse, normalizeShort } from './grading'
import type { ShownOption } from './sampling'

function shown(...flags: boolean[]): ShownOption[] {
  return flags.map((correct, i) => ({ html: `option ${i}`, correct }))
}

describe('normalizeShort', () => {
  test('applies NFKC: full-width letters, ligatures and superscripts become plain text', () => {
    expect(normalizeShort('ＦＩＦＯ')).toBe('fifo')
    expect(normalizeShort('ﬁle')).toBe('file')
    expect(normalizeShort('n²')).toBe('n2')
  })

  test('applies NFKC before lowercasing', () => {
    // The double-struck C has no lowercase of its own. Only its NFKC form, "C", lowercases to "c".
    expect(normalizeShort('ℂ')).toBe('c')
  })

  test('lowercases, and keeps accents and punctuation', () => {
    expect(normalizeShort('FiFo')).toBe('fifo')
    expect(normalizeShort('ÉCOLE')).toBe('école')
    expect(normalizeShort("Don't O(1)")).toBe("don'to(1)")
  })

  test('removes all whitespace, inside the text as well as at its ends', () => {
    expect(normalizeShort(' first  in\tfirst\nout ')).toBe('firstinfirstout')
    expect(normalizeShort('a b　c d')).toBe('abcd')
  })

  test('removes the whitespace NFKC produces, so whitespace goes after NFKC', () => {
    // NFKC turns "¨" into a space plus a combining diaeresis. Removing whitespace first would keep that space.
    expect(normalizeShort('a¨')).toBe('ä')
  })
})

describe('gradeShort', () => {
  const accepted = ['FIFO', 'first in first out']

  test('is correct when the input matches any accepted answer, ignoring case and whitespace', () => {
    expect(gradeShort(accepted, 'fifo')).toBe(true)
    expect(gradeShort(accepted, ' F I F O ')).toBe(true)
    expect(gradeShort(accepted, 'First  In First Out')).toBe(true)
    expect(gradeShort(accepted, 'firstinfirstout')).toBe(true)
    expect(gradeShort(accepted, 'ｆｉｆｏ')).toBe(true)
  })

  test('normalizes the accepted answers too', () => {
    expect(gradeShort(['Least Recently Used'], 'leastrecentlyused')).toBe(true)
    expect(gradeShort(['ＬＲＵ'], 'lru')).toBe(true)
  })

  test('is wrong for anything else: another answer, a part, an extension, or nothing', () => {
    expect(gradeShort(accepted, 'lifo')).toBe(false)
    expect(gradeShort(accepted, 'first in')).toBe(false)
    expect(gradeShort(accepted, 'fifo queue')).toBe(false)
    expect(gradeShort(accepted, '')).toBe(false)
    expect(gradeShort(accepted, '   ')).toBe(false)
    expect(gradeShort([], 'fifo')).toBe(false)
  })

  test('does not ignore accents or punctuation', () => {
    expect(gradeShort(['école'], 'ecole')).toBe(false)
    expect(gradeShort(['O(1)'], 'o1')).toBe(false)
  })
})

describe('gradeTrueFalse', () => {
  test('is correct when the chosen value is the answer', () => {
    expect(gradeTrueFalse(true, true)).toBe(true)
    expect(gradeTrueFalse(false, false)).toBe(true)
    expect(gradeTrueFalse(true, false)).toBe(false)
    expect(gradeTrueFalse(false, true)).toBe(false)
  })
})

describe('gradeChoice', () => {
  test('single choice: only the one correct option is right', () => {
    const options = shown(false, true, false, false)
    expect(gradeChoice(options, [1])).toBe(true)
    expect(gradeChoice(options, [0])).toBe(false)
    expect(gradeChoice(options, [3])).toBe(false)
  })

  test('nothing chosen is wrong', () => {
    expect(gradeChoice(shown(false, true, false, false), [])).toBe(false)
    expect(gradeChoice(shown(true, false, true, false), [])).toBe(false)
  })

  test('choosing the correct option and another one is wrong', () => {
    expect(gradeChoice(shown(false, true, false, false), [1, 0])).toBe(false)
  })

  test('an index that is not an option is wrong', () => {
    expect(gradeChoice(shown(false, true, false, false), [7])).toBe(false)
    expect(gradeChoice(shown(false, true, false, false), [1, 7])).toBe(false)
  })

  test('multiple select: correct only when the chosen set equals the correct set', () => {
    const options = shown(true, false, true, false)
    expect(gradeChoice(options, [0, 2])).toBe(true)
    expect(gradeChoice(options, [2, 0])).toBe(true)
    expect(gradeChoice(options, [0])).toBe(false)
    expect(gradeChoice(options, [2])).toBe(false)
    expect(gradeChoice(options, [0, 1])).toBe(false)
    expect(gradeChoice(options, [0, 1, 2])).toBe(false)
    expect(gradeChoice(options, [0, 1, 2, 3])).toBe(false)
    expect(gradeChoice(options, [1, 3])).toBe(false)
  })

  test('multiple select with every option correct needs all of them', () => {
    const options = shown(true, true, true)
    expect(gradeChoice(options, [0, 1, 2])).toBe(true)
    expect(gradeChoice(options, [0, 1])).toBe(false)
  })
})
