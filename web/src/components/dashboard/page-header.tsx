/** The quiet title block every section opens with. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-rise flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-1 pt-2 pb-1">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="font-serif text-3xl leading-tight font-light tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </div>
  );
}
