import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[var(--ink)] px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-[var(--accent)]">easymd</p>
        <p className="mt-2 text-sm text-[var(--mint-muted)]">
          Create a free account — then co-edit markdown with your team and agents
        </p>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </div>
  );
}
