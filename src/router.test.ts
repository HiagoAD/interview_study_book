import { expect, test } from 'vitest'
import { parseRoute } from './router'

test('parseRoute resolves every route shape', () => {
  expect(parseRoute('')).toEqual({ name: 'home' })
  expect(parseRoute('#/')).toEqual({ name: 'home' })
  expect(parseRoute('#/b/system-design')).toEqual({ name: 'book', book: 'system-design' })
  expect(parseRoute('#/b/system-design/caching')).toEqual({
    name: 'chapter',
    book: 'system-design',
    chapter: 'caching',
  })
  expect(parseRoute('#/b/system-design/caching/cache-eviction')).toEqual({
    name: 'section',
    book: 'system-design',
    chapter: 'caching',
    section: 'cache-eviction',
  })
  expect(parseRoute('#/review')).toEqual({ name: 'review' })
  expect(parseRoute('#/data')).toEqual({ name: 'data' })
  expect(parseRoute('#/nonsense')).toEqual({ name: 'not-found' })
})
