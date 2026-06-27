import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#f8f9fa] px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-2xl font-medium text-[#1a73e8]">easymd</p>
        <p className="mt-2 text-sm text-slate-600">
          Create a free account — then co-edit markdown in the live demo
        </p>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/demo" />
    </div>
  );
}
