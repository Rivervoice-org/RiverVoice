import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const metadata = { title: "Enter your code" };

export default function VerifyPage() {
  return (
    <AuthCard
      title="Enter your code"
      blurb="We sent a six-digit code to you@company.com."
      footer={
        <>
          Wrong address?{" "}
          <Link href="/sign-in" className="text-foreground underline underline-offset-4">
            Go back
          </Link>
        </>
      }
    >
      <InputOTP maxLength={6} containerClassName="justify-between">
        <InputOTPGroup className="gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className="size-11 rounded-lg border font-mono text-base"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>

      <Button size="lg" className="w-full justify-center">
        Continue
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        Didn&rsquo;t get it? You can ask for another in 30 seconds.
      </p>
    </AuthCard>
  );
}
