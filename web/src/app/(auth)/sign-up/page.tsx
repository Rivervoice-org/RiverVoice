import Link from "next/link";

import { AuthCard, AuthProviders } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

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
      <SignUpForm />

      <AuthProviders />

      <p className="text-center text-[11px] leading-4 text-muted-foreground">
        By continuing you agree to the terms and the privacy policy.
      </p>
    </AuthCard>
  );
}
