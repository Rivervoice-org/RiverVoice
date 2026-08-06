import { cn } from "@/lib/utils";

/**
 * One heading treatment for every section: a mono eyebrow, a tight sans title,
 * and an optional line of prose. Sections stay recognisably siblings.
 */
export function SectionHeading({
  eyebrow,
  title,
  blurb,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  blurb?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-[28px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-[36px]">
        {title}
      </h2>

      {blurb ? (
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground sm:text-base">{blurb}</p>
      ) : null}
    </div>
  );
}
