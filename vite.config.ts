import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [svelte()],
	server: {
		port: 3001,
		host: '0.0.0.0',
		// watch: {
		// 	ignored: ['!**/node_modules/three/**'],
		// },
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
})
