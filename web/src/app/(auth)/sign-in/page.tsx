import Link from "next/link";

import { AuthCard, AuthProviders, Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      blurb="Pick up where your agents left off."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <Field label="Work email" type="email" autoComplete="email" placeholder="you@company.com" />

      <Field
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

      <Button size="lg" className="mt-1 h-10 w-full justify-center">
        Sign in
      </Button>

      <AuthProviders />
    </AuthCard>
  );
}
