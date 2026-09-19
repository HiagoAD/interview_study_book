/**
 * Brings a block that has just appeared into view, from its top. It stays put when its top is already in the
 * upper half of the screen, so a question that opens right where the reader is looking doesn't jump.
 */
export function reveal(element: HTMLElement): void {
  const { top } = element.getBoundingClientRect()
  if (top < 0 || top > window.innerHeight / 2) element.scrollIntoView({ block: 'start' })
}
