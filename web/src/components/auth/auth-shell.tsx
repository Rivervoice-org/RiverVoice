import Google from "@lobehub/icons/es/Google";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Title, blurb, form, and the one line under it. */
export function AuthCard({
  title,
  blurb,
  children,
  footer,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>

      <div className="mt-8 flex flex-col gap-4">{children}</div>

      {footer ? (
        <div className="mt-8 text-center text-[13px] text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}

/** A labelled field, so every form on these pages lines up the same way. */
export function Field({
  label,
  hint,
  aside,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: string;
  aside?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2 text-[13px] font-medium">
        {label}
        {aside}
      </span>
      <Input className="h-10 px-3" {...props} />
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/** The other way in, kept below the form. */
export function AuthProviders() {
  return (
    <>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="h-10 w-full justify-center gap-2.5">
        <Google size={16} />
        Continue with Google
      </Button>
    </>
  );
}
