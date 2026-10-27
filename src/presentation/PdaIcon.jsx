export function PdaIcon({ name, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === 'phone' && (
        <>
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </>
      )}
      {name === 'qr' && (
        <>
          <rect width="5" height="5" x="3" y="3" rx="1" />
          <rect width="5" height="5" x="16" y="3" rx="1" />
          <rect width="5" height="5" x="3" y="16" rx="1" />
          <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
          <path d="M21 21v.01" />
          <path d="M12 7v3a2 2 0 0 1-2 2H7" />
          <path d="M3 12h.01" />
          <path d="M12 3h.01" />
          <path d="M12 16v.01" />
          <path d="M16 12h1" />
          <path d="M21 12v.01" />
          <path d="M12 21v-1" />
        </>
      )}
      {name === 'devices' && (
        <>
          <path d="M10 22H6a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v4" />
          <path d="M11 18h.01" />
          <path d="M22 22a4 4 0 00-8 0" />
          <circle cx="18" cy="15" r="3" />
        </>
      )}
      {name === 'copy' && (
        <>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </>
      )}
      {name === 'ellipsis' && (
        <>
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M3 11a9 9 0 0 1 15.36-6.36L21 7" />
          <path d="M21 3v4h-4" />
          <path d="M21 13a9 9 0 0 1-15.36 6.36L3 17" />
          <path d="M3 21v-4h4" />
        </>
      )}
    </svg>
  )
}
