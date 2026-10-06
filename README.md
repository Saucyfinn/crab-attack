# Crab Attack

A small phone-friendly beach game. Use touch gestures to shoo crabs away with a towel and protect your sandcastle. No shooting or complicated controls.

## Play

Open `index.html` in a browser. Tap **Let's play**, then swipe across approaching crabs, or swing your towel like a golf club. Three crabs getting through ends the game. After each short round, tap **Build & next round** to grow your sandcastle and restore its hearts. Clear eight rounds to win.

Wet sand in round 2 makes crabs move twice as fast, and round 6 is a pop-up round where crabs burrow up at random and only accurate taps catch them. Later rounds bring bigger hordes, jumpy crabs and armoured crabs that need stronger towel tricks. Use the pause button to take a break; switching apps also pauses the game.

No installation, dependencies, or build step required. For a local server, run `python3 -m http.server 8000` and visit http://localhost:8000. On a phone, host this file with an HTTPS static web host or use a reachable local-network server.

## iOS app

Open `ios/CrabAttack.xcodeproj` in Xcode, pick an iPhone simulator or your iPhone, and press Run. The app shows the game full-screen in a web view and bundles the repo's `index.html` directly, so changes to the game appear on the next build. To run on a physical iPhone, choose your team under **Signing & Capabilities**. The project is generated from `ios/project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen); run `xcodegen` in `ios/` after editing that file.

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

## Stars, retries and sound

Each round awards up to three stars: ★ for clearing it, ★ for losing no hearts, and ★ for landing a ×4 combo (four hits in a row, alternating tricks, each within two seconds). Your best stars per round are saved in the browser, and the total out of 24 shows on the start and build screens.

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

Each round you clear wins a prize: jandals, then a sun lounger, a chilly bin, a beach umbrella, a boogie board, a windbreak and a picnic hamper. Prizes wait in the tray beside the castle. Drag one onto the open sand to place it; each can be used once per attempt at a round. A crab that walks into a prize stops for a moment before climbing over, and the prize is knocked over after holding up its quota of crabs.

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
| 6 Pop-up crabs | — | 34 | pops every 0.85 s, down to 0.35 s | crabs burrow up one at a time |
| 7 Crab train | 6 | 141 | 2.4 s | more jumpy and shell crabs |
| 8 Last tide | 6 | 147 | 2.4 s | two kings per surge |

From round 3, each surge is one crab bigger than the last, and every surge is slightly faster. Rounds 1–2 use only plain crabs that follow predictable paths. The build screen previews the next round's threat.

**Jumpy crabs** (from round 4, up to about half the horde by round 8) sidestep at random, dash forward and stop suddenly. A puff of sand marks a dash. On wet sand, dashes are reduced so they don't stack with the water's double speed.

**Tough crabs** need stronger tricks:

- **Purple shell crab** (round 3+, 20 points): a whip, spin or power snap clears it. A tap or sweep cracks the shell and knocks it back, and the next hit clears it.
- **Crowned king crab** (round 5+, 40 points): only a spin or power snap clears it. Other tricks knock it back and stun it briefly. Kings are bigger and a little slower.

**Pop-up crabs** (round 6) burrow up anywhere within reach. They duck under swipes, spins and whips, so only a tap within 28 units of the crab catches one. A crab left up too long (1.4 s at first, 0.8 s by the end) runs for the castle.

Wet sand still doubles crab speed in round 2. Knockbacks never push crabs off the beach. After a hit, the castle has 0.9 seconds of protection so simultaneous arrivals cannot take all three hearts in one frame. Particle effects and towel trails are capped for the phone prototype.
