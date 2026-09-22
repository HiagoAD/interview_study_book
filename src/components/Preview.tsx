import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { books } from 'virtual:content'
import { Html } from './Html'
import { previewTarget, sectionLead } from './previewTarget'
import type { PreviewTarget } from './previewTarget'
import { placePreview } from './previewPlacement'
import type { Box, Placement } from './previewPlacement'
import { useRoute } from '../router'
import { isSectionUnlocked } from '../engine/sections'
import { useProgress } from '../storage/useProgress'

/** Long enough that a pointer crossing a link does not open anything, short enough to feel like an answer. */
const OPEN_DELAY_MS = 300
/** The pointer has to cross the gap between the link and the card, so leaving one does not close it at once. */
const CLOSE_DELAY_MS = 200

/** What `Html` calls as the pointer and the keyboard move over rendered content. */
export interface PreviewHandlers {
  onMouseOver(event: React.MouseEvent): void
  onMouseOut(event: React.MouseEvent): void
  onFocus(event: React.FocusEvent): void
  onBlur(event: React.FocusEvent): void
}

const NONE: PreviewHandlers = { onMouseOver: () => {}, onMouseOut: () => {}, onFocus: () => {}, onBlur: () => {} }

const PreviewContext = createContext<PreviewHandlers>(NONE)

/** Outside a provider, and inside a card, this is every handler doing nothing, so no card opens a card. */
export function usePreviewHandlers(): PreviewHandlers {
  return useContext(PreviewContext)
}

interface Open {
  target: PreviewTarget
  anchor: Box
}

/** The link under `node`, when it is one of the cross-reference links inside `container`. */
function refUnder(node: EventTarget | null, container: EventTarget | null): HTMLAnchorElement | null {
  const link = node instanceof Element ? node.closest('a.ref') : null
  return link instanceof HTMLAnchorElement && container instanceof Node && container.contains(link) ? link : null
}

function boxOf(link: HTMLAnchorElement): Box {
  const rect = link.getBoundingClientRect()
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height }
}

/**
 * Holds the one preview card for the page and hands `Html` the handlers that open and close it. The card is
 * drawn into `document.body`, positioned in page coordinates, so it travels with the page and needs no
 * scroll listener.
 */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const route = useRoute()

  // A touch screen has no hover: a tap is a click, and following the link is the whole interaction there.
  const canHover = useMemo(() => typeof window.matchMedia !== 'function' || window.matchMedia('(hover: hover)').matches, [])

  const cancel = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  const close = useCallback(() => {
    cancel()
    setOpen(null)
  }, [cancel])

  const show = useCallback(
    (link: HTMLAnchorElement) => {
      const target = previewTarget(link.getAttribute('href'), books)
      if (target) setOpen({ target, anchor: boxOf(link) })
    },
    [],
  )

  const handlers = useMemo<PreviewHandlers>(
    () => ({
      onMouseOver(event) {
        if (!canHover) return
        const link = refUnder(event.target, event.currentTarget)
        if (!link) return
        cancel()
        openTimer.current = setTimeout(() => show(link), OPEN_DELAY_MS)
      },
      onMouseOut(event) {
        if (!canHover || !refUnder(event.target, event.currentTarget)) return
        cancel()
        closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS)
      },
      onFocus(event) {
        const link = refUnder(event.target, event.currentTarget)
        if (!link) return
        cancel()
        show(link)
      },
      onBlur(event) {
        if (refUnder(event.target, event.currentTarget)) close()
      },
    }),
    [canHover, cancel, close, show],
  )

  // Leaving the page the card was opened from would otherwise strand it over the new one.
  const page = JSON.stringify(route)
  useEffect(() => {
    close()
  }, [page, close])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  useEffect(() => cancel, [cancel])

  return (
    <PreviewContext value={handlers}>
      {children}
      {open &&
        createPortal(
          <PreviewCard
            open={open}
            onPointerEnter={cancel}
            onPointerLeave={() => {
              cancel()
              closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS)
            }}
          />,
          document.body,
        )}
    </PreviewContext>
  )
}

function PreviewCard({ open, onPointerEnter, onPointerLeave }: { open: Open; onPointerEnter: () => void; onPointerLeave: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Measure first, place second: where it goes depends on how tall it turned out to be.
  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    setPlacement(
      placePreview(open.anchor, { width, height }, {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      }),
    )
  }, [open])

  return (
    <div
      ref={card}
      className="preview-card"
      // A preview repeats a page that the link itself already reaches, so reading it aloud would say
      // everything twice. The link is the accessible path; this is only for the eye.
      aria-hidden="true"
      data-side={placement?.side}
      style={
        placement
          ? { top: `${placement.top}px`, left: `${placement.left}px` }
          : { top: `${open.anchor.top}px`, left: `${open.anchor.left}px`, visibility: 'hidden' }
      }
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      {/* No handlers inside the card, so a link in a preview opens no second preview. */}
      <PreviewContext value={NONE}>
        <PreviewBody target={open.target} />
      </PreviewContext>
    </div>
  )
}

function PreviewBody({ target }: { target: PreviewTarget }) {
  if (target.kind === 'term') {
    return (
      <>
        <p className="preview-kind">Glossary</p>
        <p className="preview-title">{target.entry.term}</p>
        <Html html={target.entry.summary} className="prose preview-text" />
      </>
    )
  }
  return <SectionPreview target={target} />
}

function SectionPreview({ target }: { target: Extract<PreviewTarget, { kind: 'section' }> }) {
  const progress = useProgress()
  const unlocked = isSectionUnlocked(target.book.id, target.chapter, target.index, progress)
  const lead = sectionLead(target.section.html)

  return (
    <>
      <p className="preview-kind">{target.chapter.title}</p>
      <p className="preview-title">{target.section.title}</p>
      {unlocked ? (
        lead !== '' && <Html html={`<p>${lead}</p>`} className="prose preview-text preview-text-cut" />
      ) : (
        <p className="preview-text preview-locked">
          Locked.{' '}
          {target.index > 0 && <>Answer the questions in “{target.chapter.sections[target.index - 1].title}” to open it.</>}
        </p>
      )}
    </>
  )
}
