/**
 * easymd brand mark — a document with the "emd" wordmark, a green data-line
 * forming the middle stroke, a share node (top-right) and a growth arrow
 * (bottom-right).
 *
 * The document outline + letters use `currentColor` so the mark inherits the
 * surrounding text color (white in dark mode, ink in light mode). The accent
 * elements use the lime `--accent` token. Pass `accent` to override (e.g. the
 * static favicon, which can't read CSS variables).
 */
export function Logo({
  className = 'h-9 w-9',
  accent = 'var(--accent)',
  title = 'easymd',
}: {
  className?: string;
  accent?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="6 8 224 164"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      {/* document outline + folded corner */}
      <g
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M48 20 H118 L150 52 V136 A24 24 0 0 1 126 160 H48 A24 24 0 0 1 24 136 V44 A24 24 0 0 1 48 20 Z" />
        <path d="M118 20 V52 H150" />
      </g>

      {/* "e" */}
      <g
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M76 86 A20 20 0 1 0 76 110" />
        <path d="M42 99 H78" />
      </g>

      {/* "d" — bowl + stem */}
      <g
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="122" cy="102" r="18" />
        <path d="M140 52 V120" />
      </g>

      {/* green data-line forming the middle ("m") + nodes */}
      <g>
        <polyline
          points="84,106 96,88 104,118 112,88 120,104"
          stroke={accent}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[
          [84, 106],
          [96, 88],
          [104, 118],
          [112, 88],
          [120, 104],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6.5" fill={accent} />
        ))}
      </g>

      {/* share node (top-right) */}
      <g>
        <path
          d="M178 34 L206 54 M206 54 L188 82 M188 82 L178 34"
          stroke={accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="178" cy="34" r="9" fill={accent} />
        <circle cx="206" cy="54" r="9" fill={accent} />
        <circle cx="188" cy="82" r="9" fill={accent} />
      </g>

      {/* growth arrow (bottom-right) */}
      <g
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M150 156 C188 158 208 142 208 104" />
        <path d="M195 112 L208 98 L220 113" />
      </g>
    </svg>
  );
}
