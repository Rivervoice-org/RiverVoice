"use client";

import Link from "next/link";
import { useForm } from "@tanstack/react-form";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/lib/auth/queries";
import { signInSchema } from "@/lib/auth/schemas";

export function SignInForm() {
  const signIn = useSignIn();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: signInSchema },
    onSubmit: ({ value }) => signIn.mutateAsync(value),
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <FormField
            field={field}
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            field={field}
            label="Password"
            type="password"
            autoComplete="current-password"
            aside={
              <Link
                href="/verify"
                className="text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                Use a code instead
              </Link>
            }
          />
        )}
      </form.Field>

      {signIn.error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {signIn.error.message}
        </p>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            size="lg"
            type="submit"
            disabled={isSubmitting}
            className="mt-1 h-10 w-full justify-center"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
