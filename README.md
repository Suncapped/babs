# babs

> First Earth game web client, using Three.js and WebSocket

Gamedev chat at https://discord.gg/f2nbKVzgwm

## What is this?

This is the web client for First Earth, very much a work in progress!

If you would like to play the game while customizing this client code locally, you can!  See the install steps below.

This is open source mainly for the fun of anyone interested in gamedev or customizations.  In a browser game, the client code is delivered to the browser anyway, so it might as well be open sourced so that anyone can see the code, not just very technical people.  It also provides some visibility into the gamedev process, and proves you can make a game client without being a very good programmer ;)

This codebase might not be useful as a library for making a different game, because it's very specific to First Earth, and there's been no effort to make it into a good generic game engine.  But perhaps parts of it could be useful to someone.

### Install Nodejs

Requires Nodejs version 16.  An easy way to get there is using `nvm` https://github.com/nvm-sh/nvm.  Brief instructions:

```console
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
exit # Close console.  Then open a new console and:
nvm install 16
```

### Clone repo and use NodeJs

```console
git clone https://github.com/Suncapped/babs.git
cd babs
nvm use # Switches to proper Nodejs version based on project's .nvmrc
```

### Run dev server

```console
npm ci # Installs locked dependencies
npm run playerdev # Runs the dev server, connecting to prod
```
Then your browser can open `http://localhost:3001` and you'll be in the game on a custom client.  Welcome to First Earth!
