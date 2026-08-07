"use client";

import type { AnyFieldApi } from "@tanstack/react-form";

import { Field } from "@/components/auth/auth-shell";

type Props = Omit<React.ComponentProps<typeof Field>, "name" | "value" | "onChange" | "onBlur"> & {
  field: AnyFieldApi;
};

export function FormField({ field, hint, ...props }: Props) {
  const error = field.state.meta.isTouched ? field.state.meta.errors[0] : undefined;
  const message = typeof error === "string" ? error : error?.message;

  return (
    <Field
      {...props}
      name={field.name}
      value={field.state.value as string}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      hint={message ?? hint}
      aria-invalid={Boolean(message)}
    />
  );
}
