# Crab Attack

A small phone-friendly beach game. Use touch gestures to shoo crabs away with a towel and protect your sandcastle. No shooting or complicated controls.

## Play

Open `index.html` in a browser. Tap **Let's play**, then swipe across approaching crabs, or swing your towel like a golf club. Three crabs getting through ends the game. After each short round, tap **Build & next round** to grow your sandcastle and restore its hearts. The tide never stops: after 24 designed rounds across three beaches, the beaches come round again, tougher each time. Your best round is shown on the start screen.

Wet sand in round 2 makes crabs move twice as fast, and round 6 is a pop-up round where crabs burrow up at random and only accurate taps catch them. Later rounds bring bigger hordes, jumpy crabs and armoured crabs that need stronger towel tricks. Use the pause button to take a break; switching apps also pauses the game.

No installation, dependencies, or build step required. For a local server, run `python3 -m http.server 8000` and visit http://localhost:8000. On a phone, host this file with an HTTPS static web host or use a reachable local-network server.

## PC web app

The same `index.html` is an installable web app for Windows, macOS and Linux. Serve the folder over HTTP or HTTPS (for example `python3 -m http.server 8000`, then open http://localhost:8000), and in Chrome or Edge use **Install the app** on the start screen or the install icon in the address bar. It then opens in its own window and works offline: `sw.js` caches the page, `manifest.webmanifest` and the icons in `icons/`, and refreshes them in the background so updates appear on the next launch. Change `CACHE` in `sw.js` to drop old caches.

On a PC the board keeps its portrait shape, centred on a sea backdrop, and draws at the screen's real resolution. Play with the mouse: click to snap, drag to sweep, swing and release to whip. Keys: **Space** or **P** pauses, **M** mutes, **H** opens the guide, **Enter** starts. Text says "click" instead of "tap" when a mouse is in use.

The iOS and Android apps only bundle `index.html`; the web app files are ignored there.

It is hosted on Cloudflare at https://crab-attack.hvrdfbj65m.workers.dev as a static-assets Worker (`wrangler.jsonc`). `.github/workflows/cloudflare.yml` publishes it automatically whenever the web app changes on `main` (after the tests pass), or on demand from **Actions → Cloudflare → Run workflow**; it needs the `CLOUDFLARE_API_TOKEN` (from the **Edit Cloudflare Workers** token template) and `CLOUDFLARE_ACCOUNT_ID` repository secrets. To publish by hand instead, run `npx wrangler deploy` from the repo root. The Worker is also connected to Cloudflare's Git integration (Workers Builds): pushes to other branches get a preview link (`npx wrangler preview`, enabled by the `previews` block in `wrangler.jsonc`), while its builds of `main` only run `npx wrangler versions upload`, so the GitHub workflow stays the one thing that puts `main` live. `.assetsignore` allows only the page, manifest, service worker and icons to be uploaded, so the rest of the repo stays private.

## iOS app

Open `ios/CrabAttack.xcodeproj` in Xcode, pick an iPhone simulator or your iPhone, and press Run. The app shows the game full-screen in a web view and bundles the repo's `index.html` directly, so changes to the game appear on the next build. To run on a physical iPhone, choose your team under **Signing & Capabilities**. The project is generated from `ios/project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen); run `xcodegen` in `ios/` after editing that file.

### Releasing to App Store Connect without a Mac

`.github/workflows/app-store.yml` archives the app on a GitHub-hosted Mac, signs it with cloud-managed certificates and uploads it to App Store Connect. It runs on every push to `main` that changes `index.html` or `ios/`, or on demand from **Actions → App Store Connect → Run workflow**. The workflow run number becomes the build number. It needs three repository secrets from an App Store Connect API key with the Admin role (**Users and Access → Integrations → Team Keys**): `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_PRIVATE_KEY` (the contents of the `.p8` file). Before building, `ios/check_asc_key.py` checks that App Store Connect accepts the key and has the app record, and says which secret to fix if not. A second job, on a cheaper Linux runner, then waits for Apple to process the build (usually 5–30 minutes) and adds it to the TestFlight internal testing group **Internal Testers**, creating the group the first time; set the `TESTFLIGHT_GROUP` repository variable to use another internal group. Add yourself to the group once (**TestFlight → Internal Testers → Testers +**) and each new build appears in the TestFlight app on your iPhone. Internal testing needs no beta review. Builds also go to the external group **Public Testers** (or the `TESTFLIGHT_EXTERNAL_GROUP` variable; `off` turns it off), which has a public TestFlight link anyone can join. Each build gets "What to Test" from its PR title and is submitted for beta review. Apple reviews the first build of each version, usually within a day. External testing waits until the app's **TestFlight → Test Information** is filled in (description, feedback email, privacy policy URL and review contact); until then the job skips it with a warning. The privacy policy is `privacy.html`, published with the web app at https://crab-attack.hvrdfbj65m.workers.dev/privacy.html. `ios/asc_key.sh` prepares the key for both jobs and `ios/asc.py` holds the shared App Store Connect API code.

### Full game unlock

Round 1 is free. In the iPhone app, clearing round 1 offers **Unlock all rounds**, a one-time in-app purchase (non-consumable, product ID `com.saucyfinn.CrabAttack.fullgame`), plus **Restore purchase**. The Swift wrapper handles it with StoreKit 2 (`Store` in `CrabAttackApp.swift`): it injects `window.crabStore`, takes `buy`, `restore` and `status` messages from the page, and reports `storeChanged({unlocked, price, message})` back, showing the price in the player's currency. The App Store is the record of the purchase, so nothing is stored on the device. On the web and Android there is no store, so the end of round 1 says the full game is in the iPhone app (and links to it once `APP_STORE_URL` in `index.html` is set) and offers to play again from round 1. Pull requests that touch the game or `ios/` are compiled on a GitHub-hosted Mac by `.github/workflows/ios-build.yml`.

## Android app

Open the `android/` folder in Android Studio and press Run. Like the iOS app, it shows the game full-screen in a WebView and bundles the repo's `index.html` at build time. From the command line: `cd android && ./gradlew assembleDebug` builds `app/build/outputs/apk/debug/app-debug.apk` (Java 17+ is required; Android Studio's bundled runtime works). Minimum Android version is 8.0.

## Development

All styles, logic, and canvas artwork are in `index.html`. The artwork is drawn with smooth vector shapes and gradients (no image files). The game adapts to portrait phone screens and also supports mouse input. Best score is stored in the browser.

### Tests

Run `node tests/game.test.js` (Node 18+, no dependencies). It loads the game script with a stubbed browser and checks horde escalation, tough-crab armour, knockback, wet-sand speed, jumpy movement, rendering and round flow. It then plays every round with seeded casual and skilled bots, which place their prizes across the beach at the start of each round, and prints survival rates. To compare difficulty against an older build, pass it as a baseline:

```sh
git show <rev>:index.html > /tmp/old.html
node tests/game.test.js index.html /tmp/old.html
```

## Beach days: difficulty

Before a run, the start screen (and the screen after a lost round) offers three beach days:

| Mode | Difficulty | Hordes | Gap between surges | Crab speed | Jumpy crabs | Pop-ups stay up |
|---|---|---|---|---|---|---|
| 🏖️ Sunbathing | Easy | 75% | +0.6 s | 85% | half as many | 25% longer |
| 🏐 Beach sports | Hard (default) | as designed | as designed | as designed | as designed | as designed |
| 🛟 Lifeguard | Expert | 110% | −0.15 s | 105% | 25% more | 10% shorter |

Beach sports is the game exactly as designed and tuned. The choice is remembered, and each mode keeps its own best score and best round; stars are shared. With the bots, Sunbathing's two-king finales (rounds 8 and 24) are cleared almost every time, while on Lifeguard a skilled player clears them only now and then.

## Stars, retries and sound

Each round awards up to three stars: ★ for clearing it, ★ for losing no hearts, and ★ for landing a ×4 combo (four hits in a row, alternating tricks, each within two seconds). Your best stars per round are saved in the browser, and your running total shows on the start and build screens. The game never shows a last round or a maximum.

If the crabs take your castle, the game says how many crabs were left. **Retry round** replays that round from the score you started it with. **Start over** returns to round 1.

Sound effects are generated in the browser with Web Audio, so there are no audio files. Use the 🔊 button to mute; the setting is remembered. On iPhone, the ring/silent switch also silences the game. Clearing a king crab, or five or more crabs with one trick, briefly freezes the action and shakes the screen.

## Towels

Pick a towel on the start, build and retry screens; your choice is remembered. Each shows its reach, swipe width and how fast spins and power snaps recharge.

| Towel | Reach | Swipe width | Big-trick recharge | Special |
|---|---|---|---|---|
| Beach towel | 210 | 46 | 2 s | All-rounder |
| Pool towel | 270 | 38 | 2 s | Longest reach, narrow swipes |
| Bath sheet | 185 | 56 | 3 s | Widest swipes |
| Wet towel | 200 | 44 | 2 s | Snaps and sweeps clear shell crabs in one hit (kings still need a spin or power snap) |

Whips add their usual 70–200 extra reach on top of the towel's. In bot tests every towel clears the late rounds at a similar rate.

## The cowboy

He stands guard in front of the castle, seen from behind as he faces the sea, and turns toward the crab nearest the castle. His towel only reaches crabs within its reach of him (210 game units for the beach towel), shown by a dashed ring while you aim and at the start of each round. A whip reaches farther, up to 410 units with a full backswing. A trick aimed only at crabs out of reach says *Out of reach*.

## Prizes

Each round you clear ends with a prize ceremony: a battered king crab (crown askew, bandaged head, black eye) limps up the beach with your prize and hands it to the cowboy, streamers pop from both bottom corners at once, and a **You won!** card shows the prize's picture and name. **Collect prize** opens the build screen; tap the beach (or press Enter) to skip ahead to the card.

Each round you clear wins a prize: jandals, then a sun lounger, a chilly bin, a beach umbrella, a boogie board, a windbreak and a picnic hamper. Before each round starts, a setup step shows the tray of prizes beside the castle: drag prizes onto the open sand, drag placed ones to move them, or drag one off the sand to put it back, then press **Start round**. Prizes stay where you put them from round to round (and on retries) until you move them; **Start over** clears the beach. A crab that walks into a prize stops for a moment before climbing over, and the prize is knocked over after holding up its quota of crabs, coming back fresh next round.

| Prize | Holds each crab | Crabs before it falls |
|---|---|---|
| Jandals | 0.45 s | 3 |
| Sun lounger | 0.5 s | 6 |
| Chilly bin | 0.8 s | 5 |
| Beach umbrella | 0.55 s | 7 |
| Boogie board | 0.6 s | 6 |
| Windbreak | 0.6 s | 9 |
| Picnic hamper | 1.1 s | 5 |

Kings shove through in half the time.

Each new beach starts with clear sand and an empty tray, and has its own seven prizes, won in this order:

| Beach | Prizes (hold time · crabs before it falls) |
|---|---|
| Rocky Point | Bucket and spade (0.5 s · 4), Snorkel set (0.5 s · 4), Lilo (0.55 s · 6), Beach cricket set (0.6 s · 5), Kayak (0.6 s · 7), Surfboard (0.6 s · 7), Volleyball net (0.65 s · 10) |
| Night Tide | Lantern (0.7 s · 4), Fish and chips (1.3 s · 5), Sleeping bag (0.6 s · 6), Campfire (0.9 s · 6), Telescope (0.6 s · 5), Hammock (0.6 s · 9), Tent (0.8 s · 9) |

The last round of each beach wins no prize: clearing it saves the beach and moves on to the next one.

## Golden towel

Reaching a ×3 combo (three different tricks in a row, each within two seconds) turns the towel golden for 4 seconds: 50 units more reach, 12 units wider swipes, and one step more hitting power, so sweeps clear shell crabs and whips clear kings. A ring above the cowboy's hat shows the time left. It can trigger again 10 seconds after it wears off.

## Towel tricks

- **Tap — Snap:** shoo one nearby crab.
- **Swipe — Sweep:** catch multiple crabs along your swipe.
- **Swing and release — Whip:** like a golf swing. Drag back to wind up while a power bar fills and a dashed line previews the reach, then swing forward and let go. The towel cracks in the direction of the forward swing, reaching 70–200 game units beyond your finger depending on the backswing. A full backswing is a **Perfect swing** that hits a wider strip. A plain fast flick is now an ordinary sweep.
- **Draw a circle — Spin:** clears crabs within a 125-unit radius. Works clockwise or counterclockwise.
- **Hold and release — Power snap:** hold still for 0.55 seconds, then release for a 110-unit area snap. The ring shows when it is ready.

Spin and power snap share a recharge (two seconds for most towels). Successful different tricks within two seconds build a combo, awarding up to 15 bonus points. Snaps, sweeps and swings have no cooldown. The optional **?** guide pauses gameplay. Interrupted gestures are cancelled; additional fingers are ignored during a gesture.

This repository is a touch-browser prototype designed for iPhone. `ios/` wraps it in a small SwiftUI app (see **iOS app** below); it is not yet an App Store release. Gesture logic is tested with simulated touch paths; physical iPhone testing is still needed.

## Crab hordes

Pressure builds across the game and within each round:

| Round | Surges | Crabs | Gap between surges | New threat |
|---|---|---|---|---|
| 1 Beach day | 3 | 36 | 3.5 s | — |
| 2 Incoming tide | 3 | 39 | 3.2 s | wet sand |
| 3 Both sides | 4 | 66 | 3.0 s | shell crabs |
| 4 Crab parade | 4 | 70 | 2.7 s | jumpy crabs |
| 5 Diving crabs | 5 | 100 | 2.5 s | king crabs |
| 6 Pop-up crabs | — | 34 | pops every 1 s, down to 0.45 s | crabs burrow up one at a time |
| 7 Crab train | 6 | 141 | 2.4 s | more jumpy and shell crabs |
| 8 Last tide | 6 | 147 | 2.4 s | two kings per surge |

After Sunny Bay (rounds 1–8) come two more beaches of eight rounds. Each starts a little easier than round 8 to make room for its new crabs, then builds to two kings per surge again. Rounds 1–8 play exactly as before.

**Rocky Point** (rocks and rock pools along the edges)

| Round | Surges | Crabs | Gap between surges | New threat |
|---|---|---|---|---|
| 9 Rock hop | 3 | 39 | 3.3 s | hermit crabs |
| 10 Hermit hollow | 3 | 42 | 3.2 s | more hermits |
| 11 Twin trouble | 4 | 62 | 3.1 s | twin crabs |
| 12 Rock pool run | 4 | 66 | 3.0 s | rock pools (wet) |
| 13 Shell game | 4 | 70 | 2.9 s | shells, hermits and twins |
| 14 Pop-up pools | — | 38 | pops as in round 6, a little faster | crabs burrow up one at a time |
| 15 Crab conga | 5 | 100 | 2.6 s | one king per surge |
| 16 King of the rocks | 6 | 129 | 2.5 s | two kings per surge |

**Night Tide** (dark sand under the moon)

| Round | Surges | Crabs | Gap between surges | New threat |
|---|---|---|---|---|
| 17 Moonrise | 3 | 42 | 3.2 s | ghost crabs |
| 18 Ghost walk | 3 | 45 | 3.1 s | more ghosts |
| 19 Glow tide | 4 | 66 | 2.9 s | glowing water (wet) |
| 20 Moon dance | 4 | 70 | 2.8 s | hermits and ghosts |
| 21 Midnight pop-ups | — | 42 | pops as in round 6, faster still | pop-ups in the dark |
| 22 Twin moons | 5 | 100 | 2.6 s | one king, twins and ghosts |
| 23 Ghost train | 5 | 100 | 2.5 s | kings on the ghost train |
| 24 Last light | 6 | 123 | 2.5 s | two kings per surge |

Each round also has a movement pattern (sway, sides, parade, dive, train, wiggle or pop-up), shared with the first beach's rounds of the same style.

**The endless tide.** After round 24 the three beaches come round again as round 25 onwards, named "Beach day II", "Rock hop II" and so on (then III, IV…). Each lap adds 2 crabs to every surge, trims the gaps between surges, makes crabs a little faster and jumpier, lets hermit and twin crabs turn up on every beach (ghosts stay on Night Tide), and adds a king from the middle of each beach. Prizes come back **golden**: they hold crabs 15% longer and last for 2 more crabs per lap. The climb stops after the fourth lap (round 97 on), so the tide can go on for good: each lap's first rounds stay easy, and its two-king finale stays hard but beatable. The HUD shows only the round number, and the lock screen doesn't name a last round.

From round 3, each surge is one crab bigger than the last, and every surge is slightly faster. Rounds 1–2 use only plain crabs that follow predictable paths. The build screen previews the next round's threat.

**Jumpy crabs** (from round 4, up to about half the horde by round 8) sidestep at random, dash forward and stop suddenly. A puff of sand marks a dash. On wet sand, dashes are reduced so they don't stack with the water's double speed.

**Tough crabs** need stronger tricks:

- **Purple shell crab** (round 3+, 20 points): a whip, spin or power snap clears it. A tap or sweep cracks the shell and knocks it back, and the next hit clears it.
- **Crowned king crab** (round 5+, 40 points): only a spin or power snap clears it. Other tricks knock it back and stun it briefly. Kings are bigger and a little slower.

**New crabs on the later beaches:**

- **Hermit crab** (Rocky Point on, 20 points): every second or so it ducks into its spiral shell for about a second and stops moving. Any trick that reaches it then does nothing ("a hermit hid!"); hit it when it peeks out.
- **Twin crab** (round 11 on, 15 points): a tap, sweep or whip clears it but splits it into two small, quick baby crabs (5 points each). A spin or power snap clears it whole.
- **Ghost crab** (Night Tide, every lap, 20 points): a pale crab that zigzags and fades in and out. The towel passes straight through a faded ghost; it can only be hit while it shows (a little over half the time).

**Pop-up crabs** (round 6) burrow up anywhere on the far half of the beach, well away from the castle. They duck under swipes, spins and whips, so only a tap within 34 units of the crab catches one, at any distance from the cowboy. A crab left up too long (1.7 s at first, 1.1 s by the end, a little less on later beaches and laps) runs for the castle.

Wet sand still doubles crab speed in round 2. Knockbacks never push crabs off the beach. After a hit, the castle has 0.9 seconds of protection so simultaneous arrivals cannot take all three hearts in one frame. Particle effects and towel trails are capped for the phone prototype.
