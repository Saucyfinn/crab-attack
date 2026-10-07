"""Adds a freshly uploaded build to a TestFlight internal testing group (used by .github/workflows/app-store.yml).

Usage: ASC_KEY_ID=... ASC_ISSUER_ID=... python testflight.py AuthKey.p8 BUILD_NUMBER GROUP_NAME
Waits for App Store Connect to finish processing the build, creates the internal group the first time it is
needed, then adds the build to it so the group's testers can install it from the TestFlight app. Internal
testing needs no beta review.
"""
import os, sys, time, urllib.error

import asc

POLL_SECONDS, WAIT_MINUTES = 60, 50


def fail(message):
    print('::error::' + message)
    sys.exit(1)


def summary(line):
    print(line)
    try:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write(line + '\n')
    except (KeyError, OSError):
        pass


def wait_for_build(app, number):
    """Returns the build's ID once Apple has finished processing it."""
    deadline = time.time() + WAIT_MINUTES * 60
    while True:
        builds = asc.call('GET', f'/v1/builds?filter%5Bapp%5D={app}&filter%5Bversion%5D={number}&limit=1')['data']
        state = builds[0]['attributes']['processingState'] if builds else 'not listed yet'
        print(f'Build {number}: {state}')
        if state == 'VALID':
            return builds[0]['id']
        if state in ('FAILED', 'INVALID'):
            fail(f'App Store Connect could not process build {number} ({state}). Apple emails the reason to the account holder.')
        if time.time() > deadline:
            fail(f'Build {number} was still processing after {WAIT_MINUTES} minutes. Re-run this job later, or add it '
                 'to the group by hand in App Store Connect → TestFlight.')
        time.sleep(POLL_SECONDS)


def internal_group(app, name):
    """Finds the internal group called name, creating it if the app has none by that name."""
    groups = asc.call('GET', f'/v1/betaGroups?filter%5Bapp%5D={app}&limit=200')['data']
    group = next((g for g in groups if g['attributes']['name'] == name), None)
    if group:
        if not group['attributes'].get('isInternalGroup'):
            fail(f'"{name}" is an external TestFlight group, which needs beta review. Pick an internal group name.')
        return group
    print(f'Creating the internal TestFlight group "{name}"')
    return asc.call('POST', '/v1/betaGroups', {'data': {
        'type': 'betaGroups',
        'attributes': {'name': name, 'isInternalGroup': True, 'hasAccessToAllBuilds': False},
        'relationships': {'app': {'data': {'type': 'apps', 'id': app}}}}})['data']


def main(key_path, number, name):
    asc.configure(key_path)
    try:
        app = asc.app_id()
        if not app:
            fail(f'App Store Connect has no app with bundle ID {asc.BUNDLE_ID}.')
        build = wait_for_build(app, number)
        group = internal_group(app, name)
        if group['attributes'].get('hasAccessToAllBuilds'):
            summary(f'Build {number} is ready in TestFlight; "{name}" gets every build automatically.')
        else:
            asc.call('POST', f'/v1/betaGroups/{group["id"]}/relationships/builds', {'data': [{'type': 'builds', 'id': build}]})
            summary(f'Build {number} is ready in TestFlight for the internal group "{name}".')
        testers = asc.call('GET', f'/v1/betaGroups/{group["id"]}/betaTesters?limit=1')
        if not testers['meta']['paging']['total']:
            summary(f'"{name}" has no testers yet: add yourself in App Store Connect → TestFlight → {name} → Testers (+).')
    except urllib.error.HTTPError as e:
        fail(f'App Store Connect returned HTTP {e.code} for {e.url}: {e.read().decode(errors="replace")[:400]}')
    except urllib.error.URLError as e:
        fail(f'Could not reach App Store Connect: {e.reason}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
