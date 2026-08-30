#!/usr/bin/env bash
set -euo pipefail
set +x

if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: OP_NPM_TOKEN_REF=op://... OP_NPM_OTP_REF=op://... $0 <tarball>" >&2
  exit 1
fi
if [[ ${OP_NPM_TOKEN_REF:-} != op://* || ${OP_NPM_OTP_REF:-} != op://* ]]; then
  echo "OP_NPM_TOKEN_REF and OP_NPM_OTP_REF must be 1Password secret references." >&2
  exit 1
fi

npmrc=$(mktemp)
cleanup() {
  rm -f "$npmrc"
}
trap cleanup EXIT HUP INT TERM
chmod 600 "$npmrc"
printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > "$npmrc"

export NPM_CONFIG_USERCONFIG="$npmrc"
export NPM_TOKEN="$OP_NPM_TOKEN_REF"
export NPM_CONFIG_OTP="$OP_NPM_OTP_REF"
op run -- npm publish "$1" --access public
