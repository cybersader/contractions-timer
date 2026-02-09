/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,svelte,ts,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				surface: {
					DEFAULT: '#1a1625',
					secondary: '#231f30',
					elevated: '#2d2740',
				},
				accent: {
					DEFAULT: '#818cf8',
					dim: '#6366f1',
				},
				danger: '#f87171',
				success: '#4ade80',
				warning: '#fbbf24',
				water: '#3b82f6',
				intensity: {
					1: '#64b4dc',
					2: '#78c896',
					3: '#dcc850',
					4: '#e68c3c',
					5: '#dc5050',
				},
			},
			fontFamily: {
				mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
			},
		},
	},
};
