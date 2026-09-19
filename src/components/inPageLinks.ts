// Links inside rendered content that point within the page: footnote references and `[text](#id)`. The hash
// router reads every `#...` href as a route, so left alone they would land on the Not-found page. A link whose
// href starts with `#/` is a route and stays with the router.

/**
 * The element id an in-page link points at: "" for a bare `#`, and null when `href` is not an in-page link
 * (no href, another kind of URL, or a `#/...` route).
 */
export function inPageLinkId(href: string | null): string | null {
  if (href === null || !href.startsWith('#') || href.startsWith('#/')) return null
  const raw = href.slice(1)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw // a stray % that isn't an escape: the id is written as it is
  }
}

interface LinkLike {
  getAttribute(name: string): string | null
}

interface TargetLike {
  scrollIntoView(options?: ScrollIntoViewOptions): void
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  focus(options?: FocusOptions): void
}

/** The parts of a click that `followInPageLink` uses. */
export interface LinkClick {
  target: unknown
  currentTarget: unknown
  preventDefault(): void
}

interface Page {
  getElementById(id: string): TargetLike | null
  scrollTo(options: ScrollToOptions): void
}

function defaultPage(): Page {
  return { getElementById: (id) => document.getElementById(id), scrollTo: (options) => window.scrollTo(options) }
}

function closestLink(target: unknown, container: unknown): LinkLike | null {
  const element = target as { closest?: (selector: string) => LinkLike | null } | null
  const link = typeof element?.closest === 'function' ? element.closest('a[href]') : null
  const within = container as { contains?: (node: unknown) => boolean } | null
  return link && (typeof within?.contains !== 'function' || within.contains(link)) ? link : null
}

/**
 * The one click handler for every block of rendered HTML. For a click on an in-page link it stops the browser
 * from changing the hash, and scrolls to the element with that id (to the top for a bare `#`). Other clicks,
 * `#/...` routes included, are left alone. It also moves focus to the target, as the browser does for a
 * fragment, so the next Tab continues from there. A link whose target is missing does nothing.
 */
export function followInPageLink(event: LinkClick, page: Page = defaultPage()): void {
  const id = inPageLinkId(closestLink(event.target, event.currentTarget)?.getAttribute('href') ?? null)
  if (id === null) return

  event.preventDefault()
  if (id === '') return page.scrollTo({ top: 0 })

  const target = page.getElementById(id)
  if (!target) return
  target.scrollIntoView({ block: 'start' })
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}
