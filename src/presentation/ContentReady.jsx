import { Children, Fragment, cloneElement, isValidElement } from 'react'

// Añade la transición al elemento real, sin envoltorios que alteren su grid.
export function ContentReady({ children }) {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    if (child.type === Fragment)
      return <ContentReady>{child.props.children}</ContentReady>
    if (typeof child.type !== 'string') return child
    return cloneElement(child, {
      className: `${child.props.className ?? ''} content-ready`.trim()
    })
  })
}
