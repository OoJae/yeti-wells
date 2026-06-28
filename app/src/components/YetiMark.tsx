/** The Yeti-in-water roundel logo (from the brand design). */
export function YetiMark({ size = 30 }: { size?: number }) {
  const id = `yetimark-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#0B1320" stroke="#1F2E42" />
      <clipPath id={id}>
        <circle cx="16" cy="16" r="13.2" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="17.5" width="32" height="16" fill="#1C6CB2" />
        <rect x="0" y="17.5" width="32" height="2.4" fill="#5CC8FF" />
        <ellipse cx="16" cy="16.2" rx="5.7" ry="6.3" fill="#EAF6FF" />
        <circle cx="13.8" cy="15" r="1.05" fill="#0A1622" />
        <circle cx="18.2" cy="15" r="1.05" fill="#0A1622" />
        <path d="M14.2 18.3 Q16 19.6 17.8 18.3" stroke="#0A1622" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
