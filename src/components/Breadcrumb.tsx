export interface Crumb {
  label: string
  href: string
}

/** Links to the pages above this one, outermost first. */
export function Breadcrumb({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb) => (
          <li key={crumb.href}>
            <a href={crumb.href}>{crumb.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
