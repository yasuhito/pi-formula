#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 <first.tgz> <second.tgz>" >&2
  exit 2
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

gzip --decompress --stdout "$1" >"$workdir/first.tar"
gzip --decompress --stdout "$2" >"$workdir/second.tar"

if ! cmp --silent "$workdir/first.tar" "$workdir/second.tar"; then
  echo "Tarball contents differ" >&2
  exit 1
fi
