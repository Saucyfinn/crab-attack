#!/usr/bin/env bash
# Prepares the App Store Connect API key for the release jobs in .github/workflows/app-store.yml.
# Reads KEY_ID, ISSUER_ID and PRIVATE_KEY (the repository secrets), trims stray whitespace from pasted values,
# checks their shape, writes the key to $RUNNER_TEMP/asc/AuthKey.p8, exports ASC_KEY_ID and ASC_ISSUER_ID to
# later steps, and installs the Python packages the scripts need into $RUNNER_TEMP/venv.
set -euo pipefail
for name in KEY_ID ISSUER_ID PRIVATE_KEY; do
  if [ -z "${!name:-}" ]; then echo "::error::Add the ASC_$name repository secret (see the top of .github/workflows/app-store.yml)"; exit 1; fi
done
# The trimmed copies differ from the stored secrets, so GitHub would not hide them in logs on its own.
key_id=$(printf '%s' "$KEY_ID" | tr -d '[:space:]')
issuer_id=$(printf '%s' "$ISSUER_ID" | tr -d '[:space:]')
echo "::add-mask::$key_id"
echo "::add-mask::$issuer_id"
if ! [[ $key_id =~ ^[A-Z0-9]{10}$ ]]; then
  echo "::error::ASC_KEY_ID should be the 10-character key ID from the .p8 file name (AuthKey_<KEY ID>.p8), not ${#key_id} characters. Was the private key pasted into it?"; exit 1
fi
if ! [[ $issuer_id =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "::error::ASC_ISSUER_ID should look like 12345678-abcd-1234-abcd-123456789abc (copy it with the Copy button on the App Store Connect API page)."; exit 1
fi
mkdir -p "$RUNNER_TEMP/asc"
printf '%s\n' "$PRIVATE_KEY" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' > "$RUNNER_TEMP/asc/AuthKey.p8"
echo "ASC_KEY_ID=$key_id" >> "$GITHUB_ENV"
echo "ASC_ISSUER_ID=$issuer_id" >> "$GITHUB_ENV"
python3 -m venv "$RUNNER_TEMP/venv" && "$RUNNER_TEMP/venv/bin/pip" install --quiet pyjwt cryptography
