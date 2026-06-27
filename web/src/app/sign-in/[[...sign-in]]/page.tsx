import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#f8f9fa] px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-2xl font-medium text-[#1a73e8]">easymd</p>
        <p className="mt-2 text-sm text-slate-600">Sign in to open the live collaborative demo</p>
      </div>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/demo" />
    </div>
  );
}
