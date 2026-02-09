import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
	site: 'https://contractions.app',
	integrations: [
		svelte(),
		tailwind(),
		AstroPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Contraction Timer',
				short_name: 'Contractions',
				description: 'Track contractions, assess labor patterns, know when to go.',
				theme_color: '#1e1b4b',
				background_color: '#0f0d1a',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
			},
		}),
	],
	output: 'static',
});
