import { useId } from "react";

type LogoProps = {
  className?: string;
  title?: string;
  animated?: boolean;
};

/*
 * The WZORA "W/Z" mark, redrawn as vector geometry.
 * The outlined slash doubles as the last stroke of the W and cuts through the Z.
 * Everything is drawn in `currentColor`, so it follows the active theme.
 */

// Outer edge of the slash bar.
const SLASH_OUTER = "1092,615 1159,647 847,1316 780,1284";
// Hollow centre of the slash bar.
const SLASH_INNER = "1102,646 1129,659 837,1286 810,1273";
// Slash bar grown outward to cut a clean gap through the Z.
const SLASH_GAP = "1092.6,571.1 1192.2,618.3 846.4,1359.9 746.8,1312.7";

const W = "255,738 337,738 498,1081 659,738 720,738 898,1120 861,1220 689,849 528,1193 469,1193";
const Z =
  "983,738 1645,738 1645,813 1128,1119 1645,1119 1645,1193 983,1193 983,1117 1497,813 983,813";

export function Logo({ className, title = "WZORA", animated = false }: LogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const wMask = `w-mask-${uid}`;
  const zMask = `z-mask-${uid}`;

  return (
    <svg
      className={[className, animated ? "logo-animated" : ""].filter(Boolean).join(" ")}
      viewBox="230 590 1440 750"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id={wMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1932" height="1932">
          <rect x="0" y="0" width="1932" height="1932" fill="#fff" />
          <polygon points={SLASH_OUTER} fill="#000" />
        </mask>
        <mask id={zMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1932" height="1932">
          <rect x="0" y="0" width="1932" height="1932" fill="#fff" />
          <polygon points={SLASH_GAP} fill="#000" />
        </mask>
      </defs>
      <g fill="currentColor">
        <polygon className="logo-w" points={W} mask={`url(#${wMask})`} />
        <polygon className="logo-z" points={Z} mask={`url(#${zMask})`} />
        <path
          className="logo-slash"
          fillRule="evenodd"
          d={`M${SLASH_OUTER}Z M${SLASH_INNER}Z`}
        />
      </g>
    </svg>
  );
}
