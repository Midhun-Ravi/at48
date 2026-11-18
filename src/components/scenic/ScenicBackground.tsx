interface ScenicBackgroundProps {
  variant?: 'hero' | 'subtle' | 'compact';
  className?: string;
}

export default function ScenicBackground({
  variant = 'hero',
  className = '',
}: ScenicBackgroundProps) {
  if (variant === 'compact') {
    return (
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden opacity-40 ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1200 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full object-cover preserve-3d"
          preserveAspectRatio="none"
        >
          {/* Subtle rolling hill line */}
          <path
            d="M0 200 C300 160 500 220 800 180 C1000 150 1150 190 1200 170 L1200 240 L0 240 Z"
            fill="#F8E1D2"
            fillOpacity="0.45"
          />
          <path
            d="M0 220 C250 195 650 230 900 205 C1050 190 1150 215 1200 210 L1200 240 L0 240 Z"
            fill="#A3B5A4"
            fillOpacity="0.25"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full object-cover"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="warmSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F8E1D2" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#FFF7F0" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFF7F0" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="distantHills" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EADBCE" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#F8E1D2" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#EADBCE" stopOpacity="0.5" />
          </linearGradient>

          <linearGradient id="midHills" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A3B5A4" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#8EA38F" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#A3B5A4" stopOpacity="0.35" />
          </linearGradient>

          <linearGradient id="foreHills" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E6D3C3" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F8E1D2" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Sky gradient backdrop */}
        <rect width="1440" height="420" fill="url(#warmSkyGrad)" />

        {/* Distant Ghats Silhouette */}
        <path
          d="M0 240 C180 190 320 220 520 180 C720 140 880 210 1100 170 C1260 140 1360 180 1440 160 L1440 420 L0 420 Z"
          fill="url(#distantHills)"
        />

        {/* Mid-distance forest hills */}
        <path
          d="M0 285 C140 250 360 290 600 245 C820 200 1020 270 1240 230 C1340 210 1400 235 1440 225 L1440 420 L0 420 Z"
          fill="url(#midHills)"
        />

        {/* Stylized trees on mid-hill */}
        <g fill="#344F48" fillOpacity="0.15">
          {/* Tree clump 1 */}
          <path d="M220 255 C220 245 230 235 240 235 C250 235 260 245 260 255 Z" />
          <path d="M245 258 C245 250 252 242 262 242 C272 242 280 250 280 258 Z" />
          <rect x="238" y="255" width="4" height="12" fill="#344F48" fillOpacity="0.25" />
          {/* Tree clump 2 */}
          <path d="M720 215 C720 205 730 196 742 196 C754 196 764 205 764 215 Z" />
          <path d="M750 218 C750 210 758 202 768 202 C778 202 786 210 786 218 Z" />
          <rect x="740" y="215" width="4" height="14" fill="#344F48" fillOpacity="0.25" />
          {/* Tree clump 3 */}
          <path d="M1120 240 C1120 232 1128 224 1138 224 C1148 224 1156 232 1156 240 Z" />
          <rect x="1136" y="240" width="4" height="10" fill="#344F48" fillOpacity="0.25" />
        </g>

        {/* Foreground warm rolling meadow */}
        <path
          d="M0 340 C220 310 460 350 780 320 C1060 295 1280 335 1440 315 L1440 420 L0 420 Z"
          fill="url(#foreHills)"
        />

        {/* Gentle stylized warm clouds */}
        <g fill="#FFFFFF" fillOpacity="0.55">
          {/* Cloud 1 */}
          <path d="M160 85 C175 70 205 70 220 85 C235 85 245 95 245 105 C245 115 235 120 220 120 L160 120 C145 120 135 110 135 100 C135 90 145 85 160 85 Z" />
          {/* Cloud 2 */}
          <path d="M880 60 C895 48 920 48 935 60 C945 60 955 68 955 78 C955 86 945 92 935 92 L880 92 C868 92 860 84 860 76 C860 68 868 60 880 60 Z" />
          {/* Cloud 3 */}
          <path d="M1260 95 C1272 85 1292 85 1304 95 C1312 95 1320 102 1320 110 C1320 116 1312 122 1304 122 L1260 122 C1250 122 1244 115 1244 108 C1244 102 1250 95 1260 95 Z" />
        </g>
      </svg>
    </div>
  );
}
