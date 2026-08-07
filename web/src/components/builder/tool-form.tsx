"use client";

import * as React from "react";
import type { AnyFieldApi, ReactFormExtendedApi } from "@tanstack/react-form";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
// One set of steps serves every tool form. The array helpers are dropped
// because their keys are derived from the values, which are unknown here.
export type ToolForm = Omit<
  ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>,
  | "pushFieldValue"
  | "insertFieldValue"
  | "removeFieldValue"
  | "replaceFieldValue"
  | "swapFieldValues"
  | "moveFieldValues"
  | "clearFieldValues"
>;

/** Only complain about a field once the user has left it. */
function errorOf(field: AnyFieldApi) {
  if (!field.state.meta.isTouched) return undefined;
  const first = field.state.meta.errors[0];
  return typeof first === "string" ? first : (first?.message as string | undefined);
}

export function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-3.5">
      <span
        aria-hidden
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-[11px] text-background tabular-nums"
      >
        {n}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          {hint ? <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  action,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <div className="flex items-center gap-3">
          <label className="flex-1 text-[13px] font-medium">{label}</label>
          {action}
        </div>
      ) : null}
      {children}
      {(error ?? hint) ? (
        <p
          role={error ? "alert" : undefined}
          className={cn("text-[13px]", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function TextField({
  field,
  label,
  hint,
  action,
  ...props
}: React.ComponentProps<typeof Input> & {
  field: AnyFieldApi;
  label?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const error = errorOf(field);

  return (
    <Field label={label} hint={hint} error={error} action={action}>
      <Input
        {...props}
        name={field.name}
        value={field.state.value as string}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}

export function TextAreaField({
  field,
  label,
  hint,
  action,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  field: AnyFieldApi;
  label?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const error = errorOf(field);

  return (
    <Field label={label} hint={hint} error={error} action={action}>
      <Textarea
        {...props}
        name={field.name}
        value={field.state.value as string}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}

export function NumberField({
  field,
  ...props
}: React.ComponentProps<typeof Input> & { field: AnyFieldApi }) {
  return (
    <Input
      {...props}
      type="number"
      name={field.name}
      value={field.state.value as number}
      onChange={(event) => field.handleChange(event.target.valueAsNumber)}
      onBlur={field.handleBlur}
      aria-invalid={Boolean(errorOf(field))}
    />
  );
}

export function SwitchField({ field }: { field: AnyFieldApi }) {
  return (
    <Switch
      checked={field.state.value as boolean}
      onCheckedChange={(checked) => field.handleChange(checked)}
    />
  );
}

export function SegmentedField({
  field,
  options,
  className,
}: {
  field: AnyFieldApi;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Tabs
      value={field.state.value as string}
      onValueChange={(value) => field.handleChange(String(value))}
    >
      <TabsList className={cn("h-8 w-full rounded-lg p-1", className)}>
        <TabsIndicator />
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className="rounded-md text-[13px]">
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export type Pair = { id: number; key: string; value: string };

export function PairListField({
  field,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  arrow,
}: {
  field: AnyFieldApi;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  arrow?: boolean;
}) {
  const rows = field.state.value as Pair[];
  const nextId = React.useRef(1000);

  const set = (id: number, patch: Partial<Pair>) =>
    field.handleChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            value={row.key}
            onChange={(event) => set(row.id, { key: event.target.value })}
            placeholder={keyPlaceholder}
            aria-label={keyPlaceholder}
            className="h-8 min-w-0 flex-1 rounded-lg font-mono text-xs"
          />
          {arrow ? (
            <span aria-hidden className="shrink-0 text-muted-foreground">
              →
            </span>
          ) : null}
          <Input
            value={row.value}
            onChange={(event) => set(row.id, { value: event.target.value })}
            placeholder={valuePlaceholder}
            aria-label={valuePlaceholder}
            className="h-8 min-w-0 flex-1 rounded-lg font-mono text-xs"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove row"
            onClick={() => field.handleChange(rows.filter((item) => item.id !== row.id))}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button
        variant="secondary"
        size="sm"
        className="w-fit rounded-full px-3"
        onClick={() => field.handleChange([...rows, { id: nextId.current++, key: "", value: "" }])}
      >
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
}

const WHEN_OPTIONS = [
  { value: "start", label: "Call starts" },
  { value: "during", label: "During the call" },
  { value: "end", label: "Call ends" },
];

export function DescribeStep({ form }: { form: ToolForm }) {
  return (
    <Step n={1} title="Describe it">
      <form.Field name="name">
        {(field: AnyFieldApi) => (
          <TextField
            field={field}
            label="Name"
            hint="Lowercase words joined by underscores, the way a function is named."
            placeholder="get_order_status"
            className="h-9 rounded-lg font-mono text-xs"
          />
        )}
      </form.Field>

      <form.Field name="description">
        {(field: AnyFieldApi) => (
          <TextAreaField
            field={field}
            label="What it does"
            hint="This is what the agent reads to decide whether to call it, so write it for the agent, not for you."
            rows={3}
            placeholder="Checks room availability and books a stay for the given dates."
            className="min-h-20 resize-none rounded-lg px-3 py-2.5 text-[13px]"
            action={
              <Button
                variant="ghost"
                size="xs"
                type="button"
                className="shrink-0 rounded-full px-2 text-muted-foreground"
              >
                <Sparkles data-icon="inline-start" />
                Improve
              </Button>
            }
          />
        )}
      </form.Field>

      <form.Field name="when">
        {(field: AnyFieldApi) => (
          <Field label="When it runs">
            <SegmentedField field={field} options={WHEN_OPTIONS} />
          </Field>
        )}
      </form.Field>
    </Step>
  );
}

export function HandBackStep({ form, n }: { form: ToolForm; n: number }) {
  return (
    <Step n={n} title="Hand the answer back" hint="Type @ to drop in a field from the response.">
      <form.Field name="responseTemplate">
        {(field: AnyFieldApi) => (
          <TextAreaField
            field={field}
            rows={3}
            placeholder="The account balance is @balance."
            aria-label="What the agent is told"
            className="min-h-20 resize-none rounded-lg px-3 py-2.5 text-[13px]"
          />
        )}
      </form.Field>
    </Step>
  );
}

export function MappingsCard({
  form,
  keyPlaceholder,
  valuePlaceholder,
}: {
  form: ToolForm;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  return (
    <div className="surface flex flex-col gap-3 p-4">
      <div>
        <p className="text-[13px] font-medium">Save the reply into variables</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Pull fields out of the response so later steps can use them.
        </p>
      </div>
      <form.Field name="mappings">
        {(field: AnyFieldApi) => (
          <PairListField
            field={field}
            keyPlaceholder={keyPlaceholder}
            valuePlaceholder={valuePlaceholder}
            addLabel="Add mapping"
            arrow
          />
        )}
      </form.Field>
    </div>
  );
}

export function Advanced({ children }: { children: React.ReactNode }) {
  return (
    <Collapsible className="flex flex-col gap-3 border-t border-border pt-5">
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-2 text-[13px] font-semibold outline-none"
          />
        }
      >
        Advanced
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="flex flex-col gap-3 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// The <form> wraps the footer too, so its submit button reaches it.
export function ToolDialogShell({
  form,
  title,
  description,
  onCancel,
  children,
}: {
  form: ToolForm;
  title: string;
  description: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <header className="shrink-0 border-b border-border px-6 py-5">
        <DialogTitle className="text-base font-medium">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-[13px]">{description}</DialogDescription>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-6 py-6">{children}</div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button variant="ghost" size="lg" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe>
          {(state) => (
            <Button size="lg" type="submit" disabled={!state.canSubmit || state.isSubmitting}>
              {state.isSubmitting ? "Adding…" : "Add tool"}
            </Button>
          )}
        </form.Subscribe>
      </footer>
    </form>
  );
}
