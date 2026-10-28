import { Link } from 'react-router'
import { reportePublicado } from './rutasReportesHome.js'

export function ReportLink({ to, children, disponible = true, ...props }) {
  if (reportePublicado(to) && disponible)
    return (
      <Link to={to} {...props}>
        {children}
      </Link>
    )
  return (
    <a
      {...props}
      role="link"
      aria-disabled="true"
      tabIndex={0}
      onClick={(event) => event.preventDefault()}
    >
      {children}
    </a>
  )
}
