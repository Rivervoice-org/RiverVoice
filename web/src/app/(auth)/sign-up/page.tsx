import Link from "next/link";

import { AuthCard, AuthProviders, Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create an account"
      blurb="Your first agent can be answering calls today."
      footer={
        <>
          Already have one?{" "}
          <Link href="/sign-in" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <Field label="Name" autoComplete="name" placeholder="Pavan" />
      <Field label="Work email" type="email" autoComplete="email" placeholder="you@company.com" />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
      />

      <Button size="lg" className="mt-1 h-10 w-full justify-center">
        Create account
      </Button>

      <AuthProviders />

      <p className="text-center text-[11px] leading-4 text-muted-foreground">
        By continuing you agree to the terms and the privacy policy.
      </p>
    </AuthCard>
  );
}
