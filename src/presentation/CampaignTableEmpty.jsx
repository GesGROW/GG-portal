import './campaign-table-empty.css'

export function CampaignTableEmpty({ children }) {
  return (
    <div className="campaign-table-empty" role="status">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100"
        height="100"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#829896"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path vectorEffect="non-scaling-stroke" d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3" />
        <path vectorEffect="non-scaling-stroke" d="m16.5 16.5 5 5 M16.5 21.5l5-5" />
      </svg>
      <p>{children}</p>
    </div>
  )
}
