import Link from "next/link";

import { AuthCard, AuthProviders } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

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
      <SignInForm />

      <AuthProviders />
    </AuthCard>
  );
}
