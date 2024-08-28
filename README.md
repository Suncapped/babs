# babs

> A web-browser client for the player-world game First Earth, starring [three.js](https://github.com/mrdoob/three.js/) for graphics and native WebSocket for networking.

Gamedev chat at https://discord.gg/YSzu2eYVpK

## What is this?

This is the web client for First Earth, very much a work in progress!

You can try the game directly at https://earth.suncapped.com.  It's an experiment/simulation more than a game at the moment.

If you would like to run the game while customizing this client code locally, you can!  See the install steps below.

This is open source mainly for the fun of anyone interested in gamedev or customizations.  In a browser game, the client code is delivered to the browser anyway, so it might as well be open sourced so that anyone can play with the code.  It also provides some visibility into the gamedev process, and proves you can make a game client without being a very good programmer ;)

This codebase might not be useful as a library for making a different game, because it's very specific to First Earth, and there's been no effort to make it into a good generic game engine.  But perhaps parts of it could be useful to someone.

## Install Nodejs

Uses Node.js version 22 and [pnpm](https://pnpm.io/).  Brief MacOS/Linux instructions:

```console
curl -fsSL https://get.pnpm.io/install.sh | sh -
exit # Closes console.  Then open a new console and:
pnpm env use --global 22
```

## Clone repo and run dev server

```console
git clone https://github.com/Suncapped/babs.git
cd babs
pnpm install # Installs dependencies
pnpm run playerdev # Runs the game client for local dev, with connections going to prod
```
Then your browser can open `http://localhost:3001/?fe_env=playerdev`; and you're playing on the central https://earth.suncapped.com server.  Welcome to First Earth!
