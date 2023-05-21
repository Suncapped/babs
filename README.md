# babs

> A web browser client for the player-driven world game First Earth, using Three.js and WebSocket.

Gamedev chat at https://discord.gg/r4pdPTWbm5

## What is this?

This is the web client for First Earth, very much a work in progress!

If you would like to play the game while customizing this client code locally, you can!  See the install steps below.

This is open source mainly for the fun of anyone interested in gamedev or customizations.  In a browser game, the client code is delivered to the browser anyway, so it might as well be open sourced so that anyone can play with the code.  It also provides some visibility into the gamedev process, and proves you can make a game client without being a very good programmer ;)

This codebase might not be useful as a library for making a different game, because it's very specific to First Earth, and there's been no effort to make it into a good generic game engine.  But perhaps parts of it could be useful to someone.

# Install Nodejs

Requires Nodejs version 18.  An easy way to get there is using `volta` https://docs.volta.sh/guide/getting-started.  Brief MacOS/Linux instructions:

```console
curl https://get.volta.sh | bash
exit # Close console.  Then open a new console and:
volta install node@18
```

### Clone repo, then run dev server

```console
git clone https://github.com/Suncapped/babs.git
cd babs
npm ci # Installs locked dependencies
npm run playerdev # Runs the dev server, connecting to prod
```
Then your browser can open `http://localhost:3001`; and now you're playing on the central earth.suncapped.com server.  Welcome to First Earth!
