import { describe, expect, test } from 'vitest'
import { choice, deepFreeze, seededRng } from '../test-helpers'
import { sample, sampleOptions, shuffle } from './sampling'
import type { ShownOption } from './sampling'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

/** An rng that never swaps in a shuffle, so items keep their order and `sample` takes the first ones. */
const keepOrder = () => 0.999999

function pool(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`)
}

function texts(options: ShownOption[]): string[] {
  return options.map((option) => option.html)
}

describe('shuffle and sample', () => {
  test('shuffle returns a permutation and leaves its input alone', () => {
    const items = deepFreeze([1, 2, 3, 4, 5, 6])
    for (const seed of SEEDS) {
      expect([...shuffle(items, seededRng(seed))].sort()).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  test('the same rng gives the same order, and different rngs give different orders', () => {
    const items = pool('x', 6)
    expect(shuffle(items, seededRng(7))).toEqual(shuffle(items, seededRng(7)))
    const orders = new Set(SEEDS.map((seed) => shuffle(items, seededRng(seed)).join()))
    expect(orders.size).toBeGreaterThan(100)
  })

  test('every item can land in every position', () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      shuffle(['a', 'b', 'c', 'd'], seededRng(seed)).forEach((item, position) => seen.add(`${item}${position}`))
    }
    expect(seen.size).toBe(16)
  })

  test('sample takes distinct items, at most count, and all of them when there are fewer', () => {
    const items = pool('x', 5)
    for (const seed of SEEDS) {
      const picked = sample(items, 2, seededRng(seed))
      expect(picked).toHaveLength(2)
      expect(new Set(picked).size).toBe(2)
      expect(picked.every((item) => items.includes(item))).toBe(true)
    }
    expect(sample(items, 9, seededRng(1))).toHaveLength(5)
    expect(sample(items, 0, seededRng(1))).toEqual([])
    expect(sample(items, -2, seededRng(1))).toEqual([])
  })
})

describe('sampleOptions for mc', () => {
  const correct = pool('right', 3)
  const wrong = pool('wrong', 10)

  test('shows one correct option and n - 1 wrong ones, all from the pool and none twice', () => {
    for (const n of [2, 4, 5, 9]) {
      const variant = choice('mc', correct, wrong, n)
      for (const seed of SEEDS) {
        const options = sampleOptions(variant, seededRng(seed))
        expect(options).toHaveLength(n)
        expect(options.filter((o) => o.correct)).toHaveLength(1)
        expect(new Set(texts(options)).size).toBe(n)
        for (const option of options) {
          expect((option.correct ? correct : wrong).includes(option.html)).toBe(true)
        }
      }
    }
  })

  test('shows only as many wrong options as exist when n asks for more', () => {
    const variant = choice('mc', correct, ['wrong0', 'wrong1'], 6)
    for (const seed of SEEDS) {
      const options = sampleOptions(variant, seededRng(seed))
      expect(options).toHaveLength(3)
      expect(options.filter((o) => o.correct)).toHaveLength(1)
      expect(texts(options.filter((o) => !o.correct)).sort()).toEqual(['wrong0', 'wrong1'])
    }
  })

  test('any correct option and any wrong option can be drawn', () => {
    const variant = choice('mc', correct, wrong, 4)
    const shownCorrect = new Set<string>()
    const shownWrong = new Set<string>()
    for (const seed of SEEDS) {
      for (const option of sampleOptions(variant, seededRng(seed))) {
        ;(option.correct ? shownCorrect : shownWrong).add(option.html)
      }
    }
    expect([...shownCorrect].sort()).toEqual(correct)
    expect([...shownWrong].sort()).toEqual(wrong)
  })

  test('the options are shuffled: the correct one lands in every position', () => {
    const variant = choice('mc', correct, wrong, 4)
    const positions = new Set(
      SEEDS.map((seed) => sampleOptions(variant, seededRng(seed)).findIndex((option) => option.correct)),
    )
    expect([...positions].sort()).toEqual([0, 1, 2, 3])
  })

  test('draws from the injected rng: the same rng gives the same options, another gives another', () => {
    const variant = choice('mc', correct, wrong, 4)
    expect(sampleOptions(variant, seededRng(3))).toEqual(sampleOptions(variant, seededRng(3)))
    const distinct = new Set(SEEDS.map((seed) => JSON.stringify(sampleOptions(variant, seededRng(seed)))))
    expect(distinct.size).toBeGreaterThan(50)
  })

  test('with an rng that shuffles nothing, takes the first correct and the first wrong options', () => {
    expect(sampleOptions(choice('mc', correct, wrong, 4), keepOrder)).toEqual([
      { html: 'right0', correct: true },
      { html: 'wrong0', correct: false },
      { html: 'wrong1', correct: false },
      { html: 'wrong2', correct: false },
    ])
  })

  test('does not change the variant', () => {
    const variant = deepFreeze(choice('mc', correct, wrong, 4))
    expect(() => sampleOptions(variant, seededRng(1))).not.toThrow()
  })
})

describe('sampleOptions for multi', () => {
  test('shows every correct option plus n - correct wrong ones', () => {
    const correct = pool('right', 2)
    const wrong = pool('wrong', 6)
    for (const seed of SEEDS) {
      const options = sampleOptions(choice('multi', correct, wrong, 4), seededRng(seed))
      expect(options).toHaveLength(4)
      expect(texts(options.filter((o) => o.correct)).sort()).toEqual(correct)
      expect(options.filter((o) => !o.correct)).toHaveLength(2)
      expect(new Set(texts(options)).size).toBe(4)
      expect(options.filter((o) => !o.correct).every((o) => wrong.includes(o.html))).toBe(true)
    }
  })

  test('shows no wrong option, and still every correct one, when there are n or more correct options', () => {
    const correct = pool('right', 5)
    for (const seed of SEEDS) {
      const options = sampleOptions(choice('multi', correct, pool('wrong', 4), 4), seededRng(seed))
      expect(texts(options).sort()).toEqual(correct)
      expect(options.every((o) => o.correct)).toBe(true)
    }
    const exactly = sampleOptions(choice('multi', pool('right', 4), pool('wrong', 4), 4), seededRng(1))
    expect(exactly.filter((o) => !o.correct)).toHaveLength(0)
  })

  test('shows only as many wrong options as exist when n asks for more', () => {
    const correct = pool('right', 2)
    for (const seed of SEEDS) {
      const options = sampleOptions(choice('multi', correct, ['wrong0'], 6), seededRng(seed))
      expect(options).toHaveLength(3)
      expect(options.filter((o) => o.correct)).toHaveLength(2)
    }
    expect(sampleOptions(choice('multi', correct, [], 4), seededRng(1))).toHaveLength(2)
  })

  test('different wrong options are drawn, and the order is shuffled', () => {
    const variant = choice('multi', pool('right', 2), pool('wrong', 6), 4)
    const shownWrong = new Set<string>()
    const firstCorrect = new Set<number>()
    for (const seed of SEEDS) {
      const options = sampleOptions(variant, seededRng(seed))
      for (const option of options) if (!option.correct) shownWrong.add(option.html)
      firstCorrect.add(options.findIndex((o) => o.correct))
    }
    expect(shownWrong.size).toBe(6)
    expect(firstCorrect.size).toBe(3)
  })

  test('with an rng that shuffles nothing, keeps the correct options and takes the first wrong ones', () => {
    expect(sampleOptions(choice('multi', pool('right', 2), pool('wrong', 6), 4), keepOrder)).toEqual([
      { html: 'right0', correct: true },
      { html: 'right1', correct: true },
      { html: 'wrong0', correct: false },
      { html: 'wrong1', correct: false },
    ])
  })
})
