import { followInPageLink } from './inPageLinks'

interface HtmlProps {
  /** HTML from the content pipeline. */
  html: string
  as?: 'div' | 'span'
  className?: string
}

/**
 * A block of rendered content: a section, a prompt, an option or an explanation. The build made this HTML
 * from files in content/, so it is trusted. In-page links inside it (footnotes, `[x](#id)`) scroll to their
 * target and never reach the router.
 */
export function Html({ html, as: Tag = 'div', className }: HtmlProps) {
  return <Tag className={className} onClick={followInPageLink} dangerouslySetInnerHTML={{ __html: html }} />
}
