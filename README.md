# Crate

The dedicated audio file browser for professional producers — a fast, intelligent macOS app for managing audio libraries of any size.

## Overview

Crate replaces scattered DAW browsers and Finder workarounds with a single workspace for browsing, tagging, analyzing, and organizing sample libraries. Built from the ground up for audio, with no Finder constraints.

**Platform:** macOS 13+ (Ventura and later)

## Goals

- **Instant playback** — <10ms to first sound, no cut-off transients
- **DAW-agnostic** — works alongside Ableton, Logic, FL Studio, Reaper, Bitwig, Pro Tools, and any other DAW without a plugin or SDK
- **Rich tagging & smart collections** — tags, notes, BPM/key/LUFS analysis stored locally in SQLite
- **Library cleanup** — batch rename, format conversion, and metadata enrichment that travels with the file
- **Cloud sync** — tags and collections backed up and synced across machines (Pro tier)
- **AI search** — similarity search and natural language queries via CLAP audio embeddings (AI add-on)

## Stack

| Layer | Technology |
|---|---|
| App framework | [Electrobun](https://electrobun.dev) (Bun + native WebView) |
| UI | React + TypeScript |
| Audio engine | [Mediabunny](https://mediabunny.dev) (pure TS, WebCodecs, zero native deps) |
| Waveform | Wavesurfer.js |
| BPM detection | web-audio-beat-detector |
| Database | SQLite via `bun:sqlite` |
| Vector DB | Zvec (audio embeddings + hybrid search) |
| AI model | CLAP via ONNX / CoreML (Apple Neural Engine) |
| Cloud | Supabase + Cloudflare R2 |
| Payments | Stripe |

## Status

Early development. See [`docs/crate-prd-v4.pdf`](docs/crate-prd-v4.pdf) for the full product spec.
