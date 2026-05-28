// ----------------------------------------------------------------------------
// SwingCircle — SVG visualisation of boat vs anchor circle
// ----------------------------------------------------------------------------
export function SwingCircle({
  radiusMeters,
  distanceMeters,
  bearing,
  alarming,
}: {
  radiusMeters: number;
  distanceMeters: number;
  bearing: number;
  alarming: boolean;
}) {
  // Scale the view so the circle fills most of the SVG; clamp very-distant
  // boats so the dot stays visible on the edge instead of off-canvas.
  const viewRadius = 100;
  const center = 120;
  const scale = viewRadius / Math.max(radiusMeters, distanceMeters * 1.1);
  const boatX =
    center + Math.sin((bearing * Math.PI) / 180) * distanceMeters * scale;
  const boatY =
    center - Math.cos((bearing * Math.PI) / 180) * distanceMeters * scale;

  return (
    <svg
      viewBox="0 0 240 240"
      className="w-full max-w-[280px] mx-auto"
      aria-label="Anchor swing circle visualization"
    >
      {/* Compass cross */}
      <line
        x1={center}
        y1={10}
        x2={center}
        y2={230}
        stroke="currentColor"
        strokeOpacity="0.08"
      />
      <line
        x1={10}
        y1={center}
        x2={230}
        y2={center}
        stroke="currentColor"
        strokeOpacity="0.08"
      />
      {/* Swing circle */}
      <circle
        cx={center}
        cy={center}
        r={radiusMeters * scale}
        fill="none"
        stroke={alarming ? "rgb(239 68 68)" : "rgb(34 197 94)"}
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="2"
      />
      {/* Anchor mark */}
      <circle cx={center} cy={center} r={4} fill="currentColor" />
      <text
        x={center + 8}
        y={center + 14}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
      >
        ⚓
      </text>
      {/* Boat position */}
      <circle
        cx={boatX}
        cy={boatY}
        r={6}
        fill={alarming ? "rgb(239 68 68)" : "rgb(14 165 233)"}
      />
      <line
        x1={center}
        y1={center}
        x2={boatX}
        y2={boatY}
        stroke={alarming ? "rgb(239 68 68)" : "currentColor"}
        strokeOpacity={alarming ? "0.6" : "0.2"}
        strokeWidth="1.5"
      />
      <text x={5} y={15} fontSize="9" fill="currentColor" opacity="0.4">
        N
      </text>
    </svg>
  );
}
