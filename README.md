# Crab Attack

A small phone-friendly beach game. Use touch gestures to shoo crabs away with a towel and protect your sandcastle. No shooting, inventory, or complicated controls.

## Play

Open `index.html` in a browser. Tap **Let's play**, then swipe or flick across approaching crabs. Three crabs getting through ends the game. After each short round, tap **Build & next round** to grow your sandcastle and restore its hearts. Clear eight rounds to win.

Wet sand makes crabs move twice as fast. Later rounds bring bigger hordes, jumpy crabs and armoured crabs that need stronger towel tricks. Use the pause button to take a break; switching apps also pauses the game.

No installation, dependencies, or build step required. For a local server, run `python3 -m http.server 8000` and visit http://localhost:8000. On a phone, host this file with an HTTPS static web host or use a reachable local-network server.

## Development

All styles, logic, and canvas artwork are in `index.html`. The game adapts to portrait phone screens and also supports mouse input. Best score is stored in the browser.

## Towel tricks

- **Tap — Snap:** shoo one nearby crab.
- **Swipe — Sweep:** catch multiple crabs along your swipe.
- **Fast flick — Whip:** extends 110 game units beyond your finger for extra reach.
- **Draw a circle — Spin:** clears crabs within a 125-unit radius. Works clockwise or counterclockwise.
- **Hold and release — Power snap:** hold still for 0.55 seconds, then release for a 110-unit area snap. The ring shows when it is ready.

Spin and power snap share a two-second recharge. Successful different tricks within two seconds build a combo, awarding up to 15 bonus points. Basic snaps, swipes, and flicks have no cooldown. The optional **?** guide pauses gameplay. Interrupted gestures are cancelled; additional fingers are ignored during a gesture.

This repository is a touch-browser prototype designed for iPhone. It is not yet a signed native iOS app or an App Store release. Gesture logic is tested with simulated touch paths; physical iPhone testing is still needed.

## Crab hordes

Pressure builds across the game and within each round:

| Round | Surges | Crabs | Gap between surges | New threat |
|---|---|---|---|---|
| 1 Beach day | 3 | 36 | 3.5 s | — |
| 2 Incoming tide | 3 | 39 | 3.2 s | wet sand |
| 3 Both sides | 4 | 66 | 3.0 s | shell crabs |
| 4 Crab parade | 4 | 70 | 2.7 s | jumpy crabs |
| 5 Diving crabs | 5 | 100 | 2.5 s | king crabs |
| 6 Beach crossing | 5 | 105 | 2.4 s | wet sand + all of the above |
| 7 Crab train | 6 | 141 | 2.4 s | more jumpy and shell crabs |
| 8 Last tide | 6 | 147 | 2.4 s | two kings per surge |

From round 3, each surge is one crab bigger than the last, and every surge is slightly faster. Rounds 1–2 use only plain crabs that follow predictable paths. The build screen previews the next round's threat.

**Jumpy crabs** (from round 4, up to about half the horde by round 8) sidestep at random, dash forward and stop suddenly. A puff of sand marks a dash. On wet sand, dashes are reduced so they don't stack with the water's double speed.

**Tough crabs** need stronger tricks:

- **Purple shell crab** (round 3+, 20 points): a whip, spin or power snap clears it. A tap or sweep cracks the shell and knocks it back, and the next hit clears it.
- **Crowned king crab** (round 5+, 40 points): only a spin or power snap clears it. Other tricks knock it back and stun it briefly. Kings are bigger and a little slower.

Wet sand still doubles crab speed in rounds 2 and 6. Knockbacks never push crabs off the beach. After a hit, the castle has 0.9 seconds of protection so simultaneous arrivals cannot take all three hearts in one frame. Particle effects and towel trails are capped for the phone prototype.
