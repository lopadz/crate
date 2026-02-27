/**
 * Pre-build script: bundles analysisWorker.ts into a self-contained JS file
 * so Electrobun can copy it alongside index.js in the app bundle.
 *
 * Run automatically by Electrobun via scripts.preBuild in electrobun.config.ts.
 */

export {};

const result = await Bun.build({
	entrypoints: ["src/bun/analysisWorker.ts"],
	outdir: "dist/bun",
	target: "bun",
});

if (!result.success) {
	console.error("[buildWorker] Build failed:", result.logs);
	process.exit(1);
}

console.log("[buildWorker] analysisWorker.js built successfully");
