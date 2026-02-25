import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { AudioFile } from "../../shared/types";

export class MidiEngine {
  private parts: Tone.Part[] = [];

  async play(file: AudioFile): Promise<void> {
    this.stop();

    const resp = await fetch(`file://${file.path}`);
    const buf = await resp.arrayBuffer();
    const midi = new Midi(buf);

    await Tone.start();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;

    for (const track of midi.tracks) {
      if (track.notes.length === 0) continue;

      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      const part = new Tone.Part(
        (time: number, note: { name: string; duration: number; velocity: number }) => {
          synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
        },
        track.notes.map((n) => [n.time, n]),
      );
      part.start(0);
      this.parts.push(part);
    }

    Tone.Transport.start();
  }

  stop(): void {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    for (const part of this.parts) {
      part.stop();
      part.dispose();
    }
    this.parts = [];
  }

  dispose(): void {
    this.stop();
  }
}

export const midiEngine = new MidiEngine();
