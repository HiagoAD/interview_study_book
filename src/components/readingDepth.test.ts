import { expect, test } from 'vitest'
import { readingDepth } from './readingDepth'

test('a long block goes from 0 at its top to 1 when its bottom reaches the bottom of the viewport', () => {
  // 3000px of content in an 800px viewport has 2200px to travel.
  expect(readingDepth(200, 3200, 800)).toBe(0)
  expect(readingDepth(0, 3000, 800)).toBe(0)
  expect(readingDepth(-1100, 1900, 800)).toBe(0.5)
  expect(readingDepth(-2200, 800, 800)).toBe(1)
  expect(readingDepth(-2900, 100, 800)).toBe(1)
})

test('the reading area starts below whatever is pinned to the top', () => {
  // With 50px pinned, the reading area is 750px, so 3000px of content has 2250px to travel.
  expect(readingDepth(50, 3050, 800, 50)).toBe(0)
  expect(readingDepth(-1075, 1925, 800, 50)).toBe(0.5)
  expect(readingDepth(-2200, 800, 800, 50)).toBe(1)
})

test('a block shorter than the reading area counts as read once its bottom is on screen', () => {
  expect(readingDepth(900, 1200, 800)).toBe(0)
  expect(readingDepth(400, 700, 800)).toBe(1)
})
