"""Checks the App Store Connect API key used by .github/workflows/app-store.yml before a build starts.

Usage: ASC_KEY_ID=... ASC_ISSUER_ID=... python check_asc_key.py AuthKey.p8
Signs a short-lived token with the key and asks App Store Connect for the Crab Attack app record, so a wrong
key, key ID or issuer ID fails here with a clear message instead of deep inside xcodebuild.
"""
import json, os, sys, time, urllib.error, urllib.request

import jwt

BUNDLE_ID = 'com.saucyfinn.CrabAttack'


def fail(message):
    print('::error::' + message)
    sys.exit(1)


key_id, issuer_id = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
pem = open(sys.argv[1]).read()
if '-----BEGIN PRIVATE KEY-----' not in pem or '-----END PRIVATE KEY-----' not in pem:
    fail('ASC_PRIVATE_KEY must be the whole .p8 file, including the BEGIN PRIVATE KEY and END PRIVATE KEY lines.')

try:
    now = int(time.time())
    token = jwt.encode({'iss': issuer_id, 'iat': now, 'exp': now + 600, 'aud': 'appstoreconnect-v1'},
                       pem, algorithm='ES256', headers={'kid': key_id, 'typ': 'JWT'})
except Exception as e:
    fail(f'ASC_PRIVATE_KEY could not be read as a private key ({e}). Paste the .p8 file again.')

request = urllib.request.Request(f'https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]={BUNDLE_ID}',
                                 headers={'Authorization': 'Bearer ' + token})
try:
    apps = json.load(urllib.request.urlopen(request, timeout=30))['data']
except urllib.error.HTTPError as e:
    if e.code == 401:
        fail('App Store Connect rejected the API key (401). Check that ASC_KEY_ID is the key ID in the .p8 file name '
             '(AuthKey_<KEY ID>.p8) and that ASC_ISSUER_ID matches Users and Access → Integrations → App Store Connect API.')
    if e.code == 403:
        fail('The API key is valid but not allowed to do this (403). Use a team key with the Admin role.')
    fail(f'App Store Connect returned HTTP {e.code}: {e.read().decode()[:300]}')
except urllib.error.URLError as e:
    fail(f'Could not reach App Store Connect: {e.reason}')

if not apps:
    fail(f'The key works, but App Store Connect has no app with bundle ID {BUNDLE_ID}. Create it under Apps → + → New App.')
print(f"Key accepted; found {apps[0]['attributes']['name']} ({BUNDLE_ID}).")
