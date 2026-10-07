"""Hands a freshly uploaded build to TestFlight testers (used by .github/workflows/app-store.yml).

Usage: ASC_KEY_ID=... ASC_ISSUER_ID=... python testflight.py AuthKey.p8 BUILD_NUMBER INTERNAL_GROUP [EXTERNAL_GROUP]
Waits for App Store Connect to finish processing the build, then:
- adds it to the internal group (created on first use), whose testers can install it straight away;
- if EXTERNAL_GROUP is given, adds it to that external group too (created on first use, with a public link), sets
  "What to Test" from the WHAT_TO_TEST environment variable and submits it for beta review. Apple needs the app's
  Test Information filled in first, so until it is, the external part is skipped with a warning.
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


def find_group(app, name, internal):
    """Finds the group called name, creating it if the app has none by that name.

    New external groups get a public link, which works once Apple approves a build for external testing."""
    kind = 'internal' if internal else 'external'
    groups = asc.call('GET', f'/v1/betaGroups?filter%5Bapp%5D={app}&limit=200')['data']
    group = next((g for g in groups if g['attributes']['name'] == name), None)
    if group:
        if bool(group['attributes'].get('isInternalGroup')) != internal:
            fail(f'"{name}" is not an {kind} TestFlight group. Pick another name for the {kind} group.')
        if not internal and not group['attributes'].get('publicLinkEnabled'):
            group = asc.call('PATCH', f'/v1/betaGroups/{group["id"]}', {'data': {
                'type': 'betaGroups', 'id': group['id'], 'attributes': {'publicLinkEnabled': True}}})['data']
        return group
    print(f'Creating the {kind} TestFlight group "{name}"')
    attributes = ({'isInternalGroup': True, 'hasAccessToAllBuilds': False} if internal else
                  {'publicLinkEnabled': True, 'publicLinkLimitEnabled': False, 'feedbackEnabled': True})
    return asc.call('POST', '/v1/betaGroups', {'data': {
        'type': 'betaGroups', 'attributes': {'name': name, **attributes},
        'relationships': {'app': {'data': {'type': 'apps', 'id': app}}}}})['data']


def add_build(group, build):
    asc.call('POST', f'/v1/betaGroups/{group["id"]}/relationships/builds', {'data': [{'type': 'builds', 'id': build}]})


def test_information(app):
    """Returns (missing fields, beta localization) for the Test Information that external testing needs."""
    missing = []
    localizations = asc.call('GET', f'/v1/apps/{app}/betaAppLocalizations?limit=50')['data']
    localization = next((l for l in localizations if l['attributes'].get('description')), None)
    for key, label in (('description', 'Beta App Description'), ('feedbackEmail', 'Feedback Email'),
                       ('privacyPolicyUrl', 'Privacy Policy URL')):
        if not (localization or {}).get('attributes', {}).get(key):
            missing.append(label)
    detail = asc.call('GET', f'/v1/apps/{app}/betaAppReviewDetail')['data']['attributes']
    for key, label in (('contactFirstName', 'review contact first name'), ('contactLastName', 'review contact last name'),
                       ('contactEmail', 'review contact email'), ('contactPhone', 'review contact phone')):
        if not detail.get(key):
            missing.append(label)
    return missing, localization


def set_what_to_test(build, locale, text):
    localizations = asc.call('GET', f'/v1/builds/{build}/betaBuildLocalizations?limit=50')['data']
    existing = next((l for l in localizations if l['attributes']['locale'] == locale), None)
    if existing:
        asc.call('PATCH', f'/v1/betaBuildLocalizations/{existing["id"]}', {'data': {
            'type': 'betaBuildLocalizations', 'id': existing['id'], 'attributes': {'whatsNew': text}}})
    else:
        asc.call('POST', '/v1/betaBuildLocalizations', {'data': {
            'type': 'betaBuildLocalizations', 'attributes': {'locale': locale, 'whatsNew': text},
            'relationships': {'build': {'data': {'type': 'builds', 'id': build}}}}})


def submit_for_review(build):
    """Submits the build for beta review; returns a short description of the outcome."""
    try:
        asc.call('POST', '/v1/betaAppReviewSubmissions', {'data': {
            'type': 'betaAppReviewSubmissions', 'relationships': {'build': {'data': {'type': 'builds', 'id': build}}}}})
        return 'submitted for beta review'
    except urllib.error.HTTPError as e:
        if e.code not in (409, 422):
            raise
        # Apple answers 409/422 when the build is already submitted or approved, when another build of the same version
        # is still in beta review (only one at a time), or when something else blocks submission.
        body = e.read().decode(errors='replace')
        if 'ANOTHER_BUILD_IN_REVIEW' in body:
            print('::warning::Another build of this version is still in beta review, so this one was not submitted. '
                  'Re-run this job once that review finishes, or submit it in App Store Connect → TestFlight.')
            return 'not submitted yet, because another build is still in beta review (re-run this job afterwards)'
        print(f'::warning::Beta review submission was not accepted ({e.code}): {body[:400]}')
        return 'not submitted (see the warning above)'


def test_externally(app, build, number, name):
    missing, localization = test_information(app)
    if missing:
        print('::warning::Skipped external testing: fill in App Store Connect → TestFlight → Test Information first ('
              + ', '.join(missing) + ').')
        summary(f'External testing skipped until Test Information is filled in: {", ".join(missing)}.')
        return
    group = find_group(app, name, internal=False)
    what = (os.environ.get('WHAT_TO_TEST') or '').strip() or f'Build {number}'
    set_what_to_test(build, localization['attributes']['locale'], what[:4000])
    add_build(group, build)
    review = submit_for_review(build)
    summary(f'Build {number} added to the external group "{name}" and {review}. Apple reviews the first build of each '
            'version (usually within a day); later builds are often approved automatically.')
    link = group['attributes'].get('publicLink')
    summary(f'Public TestFlight link: {link} (it works once a build is approved for external testing).' if link else
            f'The public link appears in App Store Connect → TestFlight → {name} once Apple has created it.')


def main(key_path, number, name, external=''):
    asc.configure(key_path)
    try:
        app = asc.app_id()
        if not app:
            fail(f'App Store Connect has no app with bundle ID {asc.BUNDLE_ID}.')
        build = wait_for_build(app, number)
        group = find_group(app, name, internal=True)
        if group['attributes'].get('hasAccessToAllBuilds'):
            summary(f'Build {number} is ready in TestFlight; "{name}" gets every build automatically.')
        else:
            add_build(group, build)
            summary(f'Build {number} is ready in TestFlight for the internal group "{name}".')
        testers = asc.call('GET', f'/v1/betaGroups/{group["id"]}/betaTesters?limit=1')
        if not testers['meta']['paging']['total']:
            summary(f'"{name}" has no testers yet: add yourself in App Store Connect → TestFlight → {name} → Testers (+).')
        if external and external.lower() != 'off':
            test_externally(app, build, number, external)
    except urllib.error.HTTPError as e:
        fail(f'App Store Connect returned HTTP {e.code} for {e.url}: {e.read().decode(errors="replace")[:400]}')
    except urllib.error.URLError as e:
        fail(f'Could not reach App Store Connect: {e.reason}')


if __name__ == '__main__':
    main(*sys.argv[1:5])
