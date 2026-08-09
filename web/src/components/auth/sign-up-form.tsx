"use client";

import { useForm } from "@tanstack/react-form";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { useSignUp } from "@/lib/auth/queries";
import { signUpSchema } from "@/lib/auth/schemas";

export function SignUpForm() {
  const signUp = useSignUp();

  const form = useForm({
    defaultValues: {
      organizationName: "",
      userName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
    validators: { onChange: signUpSchema },
    onSubmit: ({ value }) => signUp.mutateAsync(value),
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
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="userName">
          {(field) => (
            <FormField field={field} label="Your name" autoComplete="name" placeholder="Pavan" />
          )}
        </form.Field>

        <form.Field name="organizationName">
          {(field) => (
            <FormField
              field={field}
              label="Company"
              autoComplete="organization"
              placeholder="Riverside Dental"
            />
          )}
        </form.Field>
      </div>

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

      <form.Field name="phoneNumber">
        {(field) => (
          <FormField
            field={field}
            label="Phone number"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98450 22118"
          />
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-3">
        <form.Field name="password">
          {(field) => (
            <FormField
              field={field}
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
            />
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <FormField field={field} label="Confirm" type="password" autoComplete="new-password" />
          )}
        </form.Field>
      </div>

      {signUp.error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {signUp.error.message}
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
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
