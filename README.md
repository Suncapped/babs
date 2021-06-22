# babs

> First Earth game web client, using Three.js and WebSocket

Gamedev chat at https://discord.gg/f2nbKVzgwm

## Currently useless!

This is the web client for First Earth.  It's very messy code.  It can be compiled and run locally, but won't be able to connect to the server at https://earth.suncapped.com.  

That ability will be added after player login is added to the server.  Connecting your local dev Babs client to earth.suncapped.com will be based on your player account.

### Install Nodejs

Requires Nodejs version 16.  An easy way to get there is using `nvm` https://github.com/nvm-sh/nvm.  Brief instructions:

```console
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
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
npm run dev # Runs the dev server
```
It will launch your browser to `http://localhost:8081` and you'll see an empty sky because it can't connect to a server :)
