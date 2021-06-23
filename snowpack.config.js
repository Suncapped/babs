// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    src: '/',
  },
  optimize: {
    bundle: true,
    minify: true,
    target: 'es2020',
  },
  devOptions: {
    port: 8081,
  },
  buildOptions: {
    // out: '../expressa/public', // Instead, I'll copy it manually in package.json.
    // Because this wipes target dir and I don't want unwiped cruft remaining either.
    // And anyway I switched to rsync for deploys to remote!
  },
  plugins: [
  ],
  packageOptions: {
  },
  // exclude: [
  //   '**/node_modules/**/*',
  // ],
}
