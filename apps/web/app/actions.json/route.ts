import { NextResponse } from "next/server";
import { actionHeaders } from "@/lib/actions/solana-actions";
import { getPublicEnv } from "@/lib/env";

/**
 * Tells Blink clients which pages map to Actions: a link to /vault/deposit
 * unfurls as the deposit Blink.
 */
export function GET() {
  return NextResponse.json(
    {
      rules: [
        { pathPattern: "/vault/deposit", apiPath: "/api/actions/deposit" },
        { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
      ],
    },
    { headers: actionHeaders(getPublicEnv().cluster) },
  );
}

export function OPTIONS() {
  return new Response(null, { headers: actionHeaders(getPublicEnv().cluster) });
}
