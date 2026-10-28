/** The Commune mark: three overlapping rounded squares, people gathering. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2" y="10" width="16" height="16" rx="6" fill="#2D9CFF" />
      <rect x="14" y="3" width="15" height="15" rx="5.5" fill="#FFB224" />
      <rect x="13" y="14" width="16" height="15" rx="5.5" fill="#F0523F" />
      <path d="M13 14.5h4.7a5.5 5.5 0 0 0-3.7-4.3z" fill="#12141C" fillOpacity="0.18" />
    </svg>
  );
}

export default function Brand({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-lockup">
      <BrandMark size={size} />
      <span className="brand-word">Commune</span>
    </span>
  );
}
