import { supportsCustomSelect } from '@gesgrow/core/presentation/select.js'

export function Select({ children, ...props }) {
  const custom = !props.multiple && props.size == null && supportsCustomSelect()
  return (
    <select {...props}>
      {custom && (
        <button type="button" className="scc-select-trigger">
          <selectedcontent />
        </button>
      )}
      {children}
    </select>
  )
}
