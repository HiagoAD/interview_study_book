export interface Crumb {
  label: string
  href: string
}

/**
 * Links to the pages above this one, outermost first. `label` names the landmark, which a page needs to
 * change when it shows two trails.
 */
export function Breadcrumb({ trail, label = 'Breadcrumb' }: { trail: readonly Crumb[]; label?: string }) {
  return (
    <nav className="breadcrumb" aria-label={label}>
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
