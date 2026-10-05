#!/usr/bin/env bash
# Build the vault program for the program id derived from your deployer key,
# deploy (or upgrade) it, then create a test token and open the vaults.
#
#   STABLESAVE_DEPLOYER_KEY='[…]' scripts/deploy-vault.sh https://api.devnet.solana.com --to <wallet> [--amount 10000] [--mint <mint>]
#
# Needs the Solana CLI (cargo build-sbf, solana) and `pnpm install`. Everything
# after the RPC URL is passed to `devnet setup` (packages/client/scripts/devnet.ts).
set -euo pipefail

RPC_URL="${1:?usage: deploy-vault.sh <rpc url> [setup options]}"
shift
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/target/deploy"
LIB_RS="$ROOT/programs/stablesave-vault/src/lib.rs"

keys="$(pnpm -s --filter @stablesave/client devnet keys --out "$OUT")"
PROGRAM_ID="$(sed -n 's/^program_id=//p' <<<"$keys")"
DEPLOYER="$(sed -n 's/^deployer=//p' <<<"$keys")"
echo "program id: $PROGRAM_ID"
echo "deployer:   $DEPLOYER"

# The program checks its own id, so build it with the one it will be deployed at.
cp "$LIB_RS" "$LIB_RS.orig"
trap 'mv "$LIB_RS.orig" "$LIB_RS"' EXIT
sed -i -E "s/declare_id!\(\"[1-9A-HJ-NP-Za-km-z]+\"\)/declare_id!(\"$PROGRAM_ID\")/" "$LIB_RS"
grep -q "declare_id!(\"$PROGRAM_ID\")" "$LIB_RS"
cargo build-sbf --manifest-path "$ROOT/programs/stablesave-vault/Cargo.toml" --sbf-out-dir "$OUT"

# A first deploy briefly holds the program twice (upload buffer + program account).
SIZE=$(stat -c %s "$OUT/stablesave_vault.so")
RENT=$(solana rent "$SIZE" --url "$RPC_URL" --lamports | grep -o '[0-9]\+' | head -1)
NEEDED=$((RENT * 2 + 100000000))
BALANCE=$(solana balance "$DEPLOYER" --url "$RPC_URL" --lamports | grep -o '^[0-9]\+')
echo "program size: $SIZE bytes; deployer balance: $(awk "BEGIN {print $BALANCE / 1e9}") SOL"
if ! solana program show "$PROGRAM_ID" --url "$RPC_URL" >/dev/null 2>&1 && [ "$BALANCE" -lt "$NEEDED" ]; then
  echo "::error::The deployer $DEPLOYER needs about $(awk "BEGIN {printf \"%.1f\", $NEEDED / 1e9}") SOL for the first deploy and has $(awk "BEGIN {print $BALANCE / 1e9}"). Get devnet SOL at https://faucet.solana.com and run again."
  exit 1
fi

solana program deploy "$OUT/stablesave_vault.so" \
  --program-id "$OUT/stablesave_vault-keypair.json" \
  --keypair "$OUT/deployer-keypair.json" \
  --url "$RPC_URL" \
  --commitment confirmed

pnpm -s --filter @stablesave/client devnet setup --rpc "$RPC_URL" --program "$PROGRAM_ID" "$@"
