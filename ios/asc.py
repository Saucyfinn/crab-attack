"""Minimal App Store Connect API client shared by the release scripts (check_asc_key.py, testflight.py).

Reads the key ID and issuer ID from ASC_KEY_ID and ASC_ISSUER_ID; call configure() with the .p8 path first.
"""
import json, os, time, urllib.request

import jwt

API = 'https://api.appstoreconnect.apple.com'
BUNDLE_ID = 'com.saucyfinn.CrabAttack'
_pem = None


def configure(key_path):
    global _pem
    _pem = open(key_path).read()
    return _pem


def token():
    # Back-date the start a minute so a runner clock slightly ahead of Apple's is not rejected.
    now = int(time.time())
    return jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now - 60, 'exp': now + 600, 'aud': 'appstoreconnect-v1'},
                      _pem, algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})


def call(method, path, body=None):
    """Sends one request and returns the decoded JSON (None for an empty reply). Raises urllib's HTTPError."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Authorization': 'Bearer ' + token(), 'User-Agent': 'crab-attack-ci'}
    if data:
        headers['Content-Type'] = 'application/json'
    with urllib.request.urlopen(urllib.request.Request(API + path, data=data, method=method, headers=headers),
                                timeout=30) as response:
        raw = response.read()
    return json.loads(raw) if raw else None


def app_id():
    """The App Store Connect ID of the Crab Attack app, or None if there is no app record yet."""
    apps = call('GET', f'/v1/apps?filter%5BbundleId%5D={BUNDLE_ID}')['data']
    return apps[0]['id'] if apps else None
