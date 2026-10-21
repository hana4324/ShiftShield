import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const Icons = {
  ShieldCheck: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Zap: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
  MapPin: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Dollar: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 2v20" />
      <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
    </svg>
  ),
  Star: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4 6.3 20.5l1.2-6.4L2.8 9.7l6.4-.8L12 3Z" />
    </svg>
  ),
  Message: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M20 4H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h4l4 4 4-4h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
    </svg>
  ),
  AlertTriangle: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  Clock: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  PhoneOff: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M10.7 13.3a15 15 0 0 1-3.2-4.7l2-2a1 1 0 0 0 .3-1L8.9 2.5a1 1 0 0 0-1-.7H4a2 2 0 0 0-2 2 18 18 0 0 0 7.5 13.4" />
      <path d="M22 16.9v3.1a2 2 0 0 1-2.2 2 18 18 0 0 1-6.6-2.1" />
      <path d="m2 2 20 20" />
    </svg>
  ),
  FileCheck: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  ),
  Minus: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M5 12h14" />
    </svg>
  ),
  ChevronDown: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  ArrowRight: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 14a6.5 6.5 0 0 1 4 6" />
    </svg>
  ),
  Building: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
    </svg>
  ),
  Phone: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6.2 6.2l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  ),
  Medal: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M7.2 2 4 9l4.5 2.5L12 5l3.5 6.5L20 9l-3.2-7" />
      <circle cx="12" cy="16" r="5" />
    </svg>
  ),
};

export type IconName = keyof typeof Icons;
