/**
 * Static hero illustration: shown immediately, and kept for devices without
 * WebGL, low-power devices and prefers-reduced-motion. Pure SVG, no JS.
 */
export function HeroFallback({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 440" role="img" aria-labelledby="hero-fallback-title" className={className}>
      <title id="hero-fallback-title">A phone showing a review request message and five gold stars</title>
      <defs>
        <linearGradient id="hf-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2b51d" stopOpacity="0.35" />
          <stop offset="1" stopColor="#44e843" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="410" rx="110" ry="14" fill="#373a35" opacity="0.08" />
      <circle cx="190" cy="200" r="160" fill="url(#hf-glow)" />
      <g transform="rotate(-6 180 210)">
        <rect x="95" y="30" width="170" height="350" rx="30" fill="#373a35" />
        <rect x="104" y="40" width="152" height="330" rx="23" fill="#f6f7f3" />
        <rect x="155" y="48" width="50" height="8" rx="4" fill="#373a35" />
        {/* incoming message */}
        <rect x="116" y="80" width="128" height="74" rx="14" fill="#ffffff" stroke="#e2e5dc" />
        <rect x="128" y="94" width="70" height="8" rx="4" fill="#373a35" opacity="0.8" />
        <rect x="128" y="110" width="100" height="6" rx="3" fill="#686b64" opacity="0.5" />
        <rect x="128" y="122" width="86" height="6" rx="3" fill="#686b64" opacity="0.5" />
        <rect x="128" y="136" width="54" height="10" rx="5" fill="#44e843" />
        {/* stars */}
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            transform={`translate(${122 + i * 25} 190) scale(0.9)`}
            d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z"
            fill="#f2b51d"
          />
        ))}
        <rect x="124" y="232" width="112" height="40" rx="12" fill="#44e843" />
        <rect x="146" y="249" width="68" height="7" rx="3.5" fill="#373a35" />
      </g>
    </svg>
  );
}
