/**
 * Pre-build script: bundles analysisWorker.ts into a self-contained JS file
 * so Electrobun can copy it alongside index.js in the app bundle.
 *
 * Run automatically by Electrobun via scripts.preBuild in electrobun.config.ts.
 */

export {};

// Mark audio-decode's WASM sub-decoders as external so Bun doesn't bundle
// their yEnc-encoded WASM binary data (which gets corrupted by the bundler).
// These packages are only used via dynamic import() inside audio-decode, so
// they'll fail gracefully at runtime — caught by decodeAudio's try/catch.
// WAV files use the decodeWav fast path and are unaffected.
const result = await Bun.build({
	entrypoints: ["src/bun/analysisWorker.ts"],
	outdir: "dist/bun",
	target: "bun",
	external: [
		"@wasm-audio-decoders/ogg-vorbis",
		"@wasm-audio-decoders/flac",
		"mpg123-decoder",
		"ogg-opus-decoder",
		"node-wav",
		"qoa-format",
	],
});

if (!result.success) {
	console.error("[buildWorker] Build failed:", result.logs);
	process.exit(1);
}

console.log("[buildWorker] analysisWorker.js built successfully");
