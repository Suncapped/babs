// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    public: {url: '/', static: true},
    src: '/dist',
  },
  optimize: {
    bundle: true,
    minify: true,
    target: 'es2020',
  },
  devOptions: {
    port: 8081,
	// hmr: false,
	// hmrPort: 12321,
	hmrDelay: 500,
  },
  buildOptions: {
    // out: '../expressa/public', // Instead, I'll copy it manually in package.json.
    // Because this wipes target dir and I don't want unwiped cruft remaining either.
    // And anyway I switched to rsync for deploys to remote!
  },
  plugins: [
	['@snowpack/plugin-svelte', {
		// Snowpack docs are wrong, "Fast Refresh" doesn't work with svelte premade project
		// https://github.com/snowpackjs/snowpack/tree/main/create-snowpack-app/app-template-svelte
		// Below options don't work (tried to see why, not sure)
		// https://github.com/snowpackjs/snowpack/discussions/1567
		// https://github.com/snowpackjs/snowpack/pull/1727
		// hmrOptions: { 
		// 	noReload: false,
		// 	preserveLocalState: false
		// }
		// Best method for FR then is just: // @hmr:keep
	}],
  ],
  packageOptions: {
  },
  // exclude: [
  //   '**/node_modules/**/*',
  // ],
}
