import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[var(--ink)] px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-[var(--accent)]">easymd</p>
        <p className="mt-2 text-sm text-[var(--mint-muted)]">Sign in to your collaborative markdown workspace</p>
      </div>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </div>
  );
}
