export function SiteAd() {
  return (
    <a
      className="ad"
      href="https://playdailycrossword.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg className="ad__icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="4" fill="white" stroke="currentColor" strokeWidth="2" />
        <path d="M14 1v38M26 1v38M1 14h38M1 26h38" stroke="currentColor" />
        <path d="M14 1h12v13H14zM1 14h13v12H1zM26 26h13v13H26z" fill="currentColor" />
        <g fill="currentColor" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="700">
          <text x="4" y="8">1</text><text x="29" y="8">2</text><text x="17" y="21">3</text><text x="4" y="33">4</text>
        </g>
      </svg>
      <span className="ad__content">
      <span className="ad__tag">Ad</span>
      <span className="ad__title">Daily Crossword</span>
      <span className="ad__copy">A fresh puzzle every day →</span>
      </span>
    </a>
  );
}
