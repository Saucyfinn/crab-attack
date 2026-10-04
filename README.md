# Crab Attack

A small phone-friendly beach game. Tap crabs to shoo them away with a towel and protect your sandcastle. No shooting, inventory, or complicated controls.

## Play

Open `index.html` in a browser. Tap **Let's play**, then tap approaching crabs. Three crabs getting through ends the game. After each short round, tap **Build & next round** to grow your sandcastle and restore its hearts. Clear eight rounds to win.

Wet sand makes crabs move twice as fast. Later rounds change their movement patterns. Use the pause button to take a break; switching apps also pauses the game.

No installation, dependencies, or build step required. For a local server, run `python3 -m http.server 8000` and visit http://localhost:8000. On a phone, host this file with an HTTPS static web host or use a reachable local-network server.

## Development

All styles, logic, and canvas artwork are in `index.html`. The game adapts to portrait phone screens and also supports mouse input. Best score is stored in the browser.
