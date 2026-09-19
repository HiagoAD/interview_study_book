import { expect, test } from 'vitest'
import { plural } from './plural'

test('one is singular; zero and every other count are plural', () => {
  expect(plural(1, 'section')).toBe('1 section')
  expect(plural(0, 'section')).toBe('0 sections')
  expect(plural(2, 'concept')).toBe('2 concepts')
  expect(plural(11, 'concept')).toBe('11 concepts')
})
