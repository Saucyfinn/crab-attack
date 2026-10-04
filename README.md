# Crab Attack

A small phone-friendly beach game. Use touch gestures to shoo crabs away with a towel and protect your sandcastle. No shooting, inventory, or complicated controls.

## Play

Open `index.html` in a browser. Tap **Let's play**, then swipe or flick across approaching crabs. Three crabs getting through ends the game. After each short round, tap **Build & next round** to grow your sandcastle and restore its hearts. Clear eight rounds to win.

Wet sand makes crabs move twice as fast. Later rounds change their movement patterns. Use the pause button to take a break; switching apps also pauses the game.

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

Rounds now arrive in three to five dense surges, with 13–20 crabs per surge: 39 crabs in round one, rising to 100 in the finale. Surges are 3.2 seconds apart. The existing movement themes remain, including wet sand doubling crab speed.

Sweeps and flicks catch wider groups. Spin and charged snap cover larger areas. After a hit, the castle has 0.9 seconds of protection so simultaneous arrivals cannot take all three hearts in one frame. Particle effects and towel trails are capped for the phone prototype.
