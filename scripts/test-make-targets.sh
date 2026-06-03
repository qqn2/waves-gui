#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
export NVM_DIR="${HOME}/.nvm"
# shellcheck source=/dev/null
[ -s "${NVM_DIR}/nvm.sh" ] && . "${NVM_DIR}/nvm.sh"

fail=0
ok() {
  local target=$1
  echo "=== make ${target} ==="
  if make "${target}"; then
    echo "PASS: make ${target}"
    echo
  else
    echo "FAIL: make ${target}"
    echo
    fail=$((fail + 1))
  fi
}

ok help
ok clean
ok install
ok test
ok build
[ -d dist ] || { echo "FAIL: dist/ missing after build"; fail=$((fail + 1)); }
ok check

echo "=== make preview (smoke) ==="
make preview >/tmp/wd-preview.log 2>&1 &
pid=$!
sleep 5
if curl -sf -o /dev/null "http://127.0.0.1:5173/"; then
  echo "PASS: make preview"
else
  echo "FAIL: make preview"
  tail -20 /tmp/wd-preview.log || true
  fail=$((fail + 1))
fi
kill "${pid}" 2>/dev/null || true
wait "${pid}" 2>/dev/null || true
echo

echo "=== make dev (smoke) ==="
make dev >/tmp/wd-dev.log 2>&1 &
pid=$!
sleep 5
if curl -sf -o /dev/null "http://127.0.0.1:5173/"; then
  echo "PASS: make dev"
else
  echo "FAIL: make dev"
  tail -20 /tmp/wd-dev.log || true
  fail=$((fail + 1))
fi
kill "${pid}" 2>/dev/null || true
wait "${pid}" 2>/dev/null || true
echo

if [ "${fail}" -eq 0 ]; then
  echo "All make targets OK (8 recipes)"
  exit 0
fi
echo "${fail} make target(s) failed"
exit 1
