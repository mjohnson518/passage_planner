// Decorative SVG components shared across the landing page sections.

export function CompassRose({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="100"
        cy="100"
        r="95"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />
      <circle
        cx="100"
        cy="100"
        r="80"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
      />
      <circle
        cx="100"
        cy="100"
        r="60"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
      />
      {/* Cardinal directions */}
      <path
        d="M100 5 L103 40 L100 35 L97 40 Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M100 195 L103 160 L100 165 L97 160 Z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M5 100 L40 103 L35 100 L40 97 Z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M195 100 L160 103 L165 100 L160 97 Z"
        fill="currentColor"
        opacity="0.3"
      />
      {/* Intercardinal */}
      <path
        d="M30 30 L55 55"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <path
        d="M170 30 L145 55"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <path
        d="M30 170 L55 145"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <path
        d="M170 170 L145 145"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <circle cx="100" cy="100" r="5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function WaveDecoration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 120"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.08"
      />
      <path
        d="M0,80 C200,140 400,20 600,80 C800,140 1000,20 1200,80 L1200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.05"
      />
    </svg>
  );
}
