import Image from "next/image";
import Link from "next/link";

/**
 * Brand lockup. Renders /brand/logo.svg (placeholder until the real file is dropped in).
 * Proportions: 520x120 (horizontal shield + wordmark).
 */
export function BrandLogo({
  height = 36,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round((height * 520) / 120);
  return (
    <Image
      src="/brand/logo.svg"
      alt="ShiftShield"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={className}
    />
  );
}

export function LogoLink({
  height = 36,
  priority = false,
}: {
  height?: number;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="ShiftShield home"
      className="inline-flex items-center rounded-md focus-ring"
    >
      <BrandLogo height={height} priority={priority} />
    </Link>
  );
}
