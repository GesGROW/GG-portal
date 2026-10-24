// Fallback local del Design System: parcelas y líneas de cultivo geométricas.
// Sustituible por fotografía aprobada sin cambiar la composición ni los datos.
export function AgriculturalVisual({ className = '' }) {
  return (
    <svg
      className={`agricultural-visual ${className}`}
      viewBox="0 0 800 640"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <path fill="var(--green-900)" d="M0 0h800v640H0z" />
      <path fill="var(--green-800)" d="m0 80 390 170L160 640H0z" />
      <path fill="var(--green-700)" d="m440 0 360 120v520H160L390 250z" />
      <path fill="var(--green-600)" d="m440 0-50 250 410 170V120z" />
      <path fill="var(--harvest-700)" d="m660 362 140 58v160l-208-85z" />
      <g stroke="var(--green-300)" strokeWidth="2" opacity=".36">
        {Array.from({ length: 13 }, (_, i) => (
          <path
            key={i}
            d={`M${470 + i * 34} 0 ${420 + i * 34} 263M${370 - i * 26} 290 ${164 - i * 26} 640`}
          />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`m${440 - i * 21} ${290 + i * 37} 440 182`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M0 ${110 + i * 30} ${335 - i * 16} ${256 + i * 30}`} />
        ))}
      </g>
      <path
        d="m440 0-50 250L160 640m230-390 410 170"
        stroke="var(--green-200)"
        strokeWidth="12"
        opacity=".65"
      />
    </svg>
  )
}
