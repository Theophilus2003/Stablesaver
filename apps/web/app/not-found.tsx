import { Button } from "@stablesave/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center px-4 pt-24 text-center">
      <p className="text-[13px] text-fg-subtle">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Nothing here</h1>
      <p className="mt-3 text-sm text-fg-muted">That page or option doesn&apos;t exist, or isn&apos;t available right now.</p>
      <Button asChild className="mt-6">
        <Link href="/">Back to options</Link>
      </Button>
    </div>
  );
}
