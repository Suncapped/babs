import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import * as path from 'path'

// https://vitejs.dev/config/
let config = {
	plugins: [
		svelte(),
		{
			// Display a URL that has the fe_env param for playerdev
			name: 'log-full-url',
			configResolved(config) {
				const serverConfig = config.server
				const openUrl = serverConfig.open
				// console.log(config)
				if (serverConfig && openUrl) {
					setTimeout(() => {
						console.log(`\n  ➜  Full Local URL:   http://localhost:${serverConfig.port || 3000}${openUrl}`)
						console.log(`  ➜  Full Network URL: http://[your network IP]:${serverConfig.port || 3000}${openUrl}\n`)
					}, 200)
				}
			},
		},
	],
	server: {
		port: 3001,
		host: '0.0.0.0',
		// watch: {
		// 	ignored: ['!**/node_modules/three/**'],
		// },
		...(process.env.FE_ENV && { open: `/?fe_env=${process.env.FE_ENV}` }),
	},
	build: {
		sourcemap: true,
		minify: false,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	// optimizeDeps: {
	// 	exclude: ['three'],
	// },


}

// For playerdev mode, add a url param so that index.html can know it's playerdev.
if(process.env.FE_ENV) {
	config.server.open = `/?fe_env=${process.env.FE_ENV}`
}
else { // Otherwise, for regular dev, ensure the param isn't re-used.
	config.server.open = '/'
}

export default defineConfig(config)
