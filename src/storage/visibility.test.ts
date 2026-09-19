import { describe, expect, test, vi } from 'vitest'
import { onBecameVisible } from './visibility'
import type { VisibilitySource } from './visibility'

/** A stand-in for `document` whose visibility the test controls. */
function fakeDocument() {
  const target = new EventTarget()
  const state = { visibilityState: 'visible' as DocumentVisibilityState }
  const source = {
    get visibilityState() {
      return state.visibilityState
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  } as VisibilitySource
  return {
    source,
    change(next: DocumentVisibilityState) {
      state.visibilityState = next
      target.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

describe('onBecameVisible', () => {
  test('calls back each time the page becomes visible', () => {
    const doc = fakeDocument()
    const callback = vi.fn()
    onBecameVisible(doc.source, callback)

    doc.change('hidden')
    doc.change('visible')
    expect(callback).toHaveBeenCalledTimes(1)
    doc.change('hidden')
    doc.change('visible')
    expect(callback).toHaveBeenCalledTimes(2)
  })

  test('does not call back when the page is hidden', () => {
    const doc = fakeDocument()
    const callback = vi.fn()
    onBecameVisible(doc.source, callback)
    doc.change('hidden')
    expect(callback).not.toHaveBeenCalled()
  })

  test('says nothing until visibility changes', () => {
    const callback = vi.fn()
    onBecameVisible(fakeDocument().source, callback)
    expect(callback).not.toHaveBeenCalled()
  })

  test('stops when the function it returns is called', () => {
    const doc = fakeDocument()
    const callback = vi.fn()
    const stop = onBecameVisible(doc.source, callback)
    stop()
    doc.change('hidden')
    doc.change('visible')
    expect(callback).not.toHaveBeenCalled()
  })

  test('two listeners are independent', () => {
    const doc = fakeDocument()
    const first = vi.fn()
    const second = vi.fn()
    const stop = onBecameVisible(doc.source, first)
    onBecameVisible(doc.source, second)
    stop()
    doc.change('visible')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
