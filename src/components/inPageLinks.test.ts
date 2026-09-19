import { describe, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { followInPageLink, inPageLinkId } from './inPageLinks'

describe('inPageLinkId', () => {
  test('a href that starts with # but not #/ is an in-page link, and the id follows the #', () => {
    expect(inPageLinkId('#user-content-fn-1')).toBe('user-content-fn-1')
    expect(inPageLinkId('#hit-rate')).toBe('hit-rate')
    expect(inPageLinkId('#a')).toBe('a')
  })

  test('a bare # is an in-page link to the top', () => {
    expect(inPageLinkId('#')).toBe('')
  })

  test('a #/ href is a route, not an in-page link', () => {
    expect(inPageLinkId('#/')).toBeNull()
    expect(inPageLinkId('#/data')).toBeNull()
    expect(inPageLinkId('#/b/sample-book/caching/cache-eviction')).toBeNull()
  })

  test('other hrefs are not in-page links', () => {
    expect(inPageLinkId(null)).toBeNull()
    expect(inPageLinkId('')).toBeNull()
    expect(inPageLinkId('https://example.com/#top')).toBeNull()
    expect(inPageLinkId('page.html#top')).toBeNull()
    expect(inPageLinkId('mailto:someone@example.com')).toBeNull()
  })

  test('percent escapes in the id are decoded, and a malformed one is used as written', () => {
    expect(inPageLinkId('#caf%C3%A9')).toBe('café')
    expect(inPageLinkId('#100%')).toBe('100%')
  })
})

interface FakeTarget {
  scrollIntoView: Mock<(options?: ScrollIntoViewOptions) => void>
  hasAttribute: Mock<(name: string) => boolean>
  setAttribute: Mock<(name: string, value: string) => void>
  focus: Mock<(options?: FocusOptions) => void>
}

function fakeTarget(hasTabindex = false): FakeTarget {
  return { scrollIntoView: vi.fn(), hasAttribute: vi.fn(() => hasTabindex), setAttribute: vi.fn(), focus: vi.fn() }
}

/** A click on `href`, inside a container that holds the link. */
function click(href: string | null, inside = true) {
  const link = { getAttribute: (name: string) => (name === 'href' ? href : null) }
  const container = { contains: (node: unknown) => inside && node === link }
  const target = { closest: (selector: string) => (selector === 'a[href]' && href !== null ? link : null) }
  return { target, currentTarget: container, preventDefault: vi.fn() }
}

function page(elements: Record<string, FakeTarget> = {}) {
  return {
    getElementById: vi.fn((id: string) => elements[id] ?? null),
    scrollTo: vi.fn<(options: ScrollToOptions) => void>(),
  }
}

describe('followInPageLink', () => {
  test('stops the browser from following the link and scrolls to the element', () => {
    const footnote = fakeTarget()
    const event = click('#user-content-fn-1')
    const doc = page({ 'user-content-fn-1': footnote })

    followInPageLink(event, doc)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(doc.getElementById).toHaveBeenCalledWith('user-content-fn-1')
    expect(footnote.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  test('moves focus to the target, giving it a tabindex first when it has none', () => {
    const footnote = fakeTarget()
    followInPageLink(click('#note'), page({ note: footnote }))
    expect(footnote.setAttribute).toHaveBeenCalledWith('tabindex', '-1')
    expect(footnote.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  test('leaves the tabindex of a target that already has one', () => {
    const target = fakeTarget(true)
    followInPageLink(click('#note'), page({ note: target }))
    expect(target.setAttribute).not.toHaveBeenCalled()
    expect(target.focus).toHaveBeenCalled()
  })

  test('still stops the browser when the target is missing, and scrolls nowhere', () => {
    const event = click('#nowhere')
    const doc = page()
    followInPageLink(event, doc)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(doc.scrollTo).not.toHaveBeenCalled()
  })

  test('a bare # scrolls to the top', () => {
    const event = click('#')
    const doc = page()
    followInPageLink(event, doc)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(doc.scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(doc.getElementById).not.toHaveBeenCalled()
  })

  test('looks the id up decoded', () => {
    const doc = page({ café: fakeTarget() })
    followInPageLink(click('#caf%C3%A9'), doc)
    expect(doc.getElementById).toHaveBeenCalledWith('café')
  })

  test('leaves route links to the router', () => {
    const event = click('#/b/sample-book')
    const doc = page()
    followInPageLink(event, doc)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(doc.getElementById).not.toHaveBeenCalled()
  })

  test('ignores clicks that are not on a link', () => {
    const event = click(null)
    followInPageLink(event, page())
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  test('ignores a link outside the container that caught the click', () => {
    const event = click('#note', false)
    followInPageLink(event, page({ note: fakeTarget() }))
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  test('ignores a click whose target cannot be searched, such as one with no element', () => {
    const event = { target: null, currentTarget: null, preventDefault: vi.fn() }
    followInPageLink(event, page())
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
