import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "crate",
		identifier: "crate.app",
		version: "0.1.0",
	},
	scripts: {
		preBuild: "scripts/buildWorker.ts",
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"dist/bun/analysisWorker.js": "bun/analysisWorker.js",
		},
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
