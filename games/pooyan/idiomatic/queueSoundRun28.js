// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundRun28 — queue a fixed four-command sound "run" into the sound-command ring.
 *
 * WHAT IT IS
 * One of the game's sound emitters. Where the thin single-shot emitters (queueSoundCommand01,
 * queueSoundCommand06, queueSoundCommand0A, queueSoundCommand0D, ...) each drop a single command
 * byte, this one enqueues a fixed *sequence* of four bytes back-to-back — 0x28, then 0x15, 0x16,
 * 0x17 — as one logical "run 28" sound event. Every byte is a command opcode for the audio
 * processor (a request to start/step a sound), not sample data.
 *
 * ROLE IN THE MACHINE
 * The audio side is driven through a small ring buffer in the 0x8A00 work-RAM page — the
 * sound-command ring, whose one-byte write cursor lives at 0x8A40 and walks the slots
 * 0x8A43..0x8A5E, wrapping the last slot back to the first. Game logic never pokes the audio
 * processor directly; it only appends command bytes into this ring. Once per frame the vblank
 * service drains one byte from the ring's read side and forwards it on to the audio processor. So
 * the emitters are the producer end of that queue, and calling queueSoundRun28 schedules its four
 * bytes to be played out over the next few drains.
 *
 * The four appends share the common gated tail (appendSoundCommandGated): a byte is actually written
 * only while a game is live — the in-play flag (0x8806) set, or the play-state latch (0x8F50)
 * nonzero. During attract / between lives the gate is shut and every byte is silently dropped.
 * Because that gate state does not change across these four calls within a single frame, the run is
 * enqueued all-or-nothing: either all four bytes land or none do.
 *
 * ROM 0x0FBC-0x0FD4. Grounding: [seen].
 *
 * LIVE-OUT: A = the advanced sound-command-ring write cursor left by the final append (or 0 when the
 * append gate is shut). This routine hands back exactly what its last append returns, so A on exit is
 * the append's own exit value; a caller that needs A reloads it before use.
 */

// The four command bytes of the run, appended in order. 0x28 is the run's first/lead byte — the value
// this "run 28" emitter is named for (the ROM has a sibling entry one byte along that would lead with
// 0x29 instead); 0x15/0x16/0x17 are its continuation bytes.
const TILE_FIRST = 0x28;
const TILE_SECOND = 0x15;
const TILE_THIRD = 0x16;
const TILE_FOURTH = 0x17;

export function queueSoundRun28(m) {
  // Byte 1 of the run (0x28). The gated append stashes it, and — only while play is live — writes it
  // into the ring slot the write cursor points at, then advances the cursor one slot.
  appendSoundCommandGated(m, TILE_FIRST);
  // Byte 2 (0x15) into the next ring slot, advancing the cursor again (and wrapping 0x8A5E -> 0x8A43
  // if it reaches the end of the ring).
  appendSoundCommandGated(m, TILE_SECOND);
  // Byte 3 (0x16) into the following slot.
  appendSoundCommandGated(m, TILE_THIRD);
  // Byte 4 (0x17), the final byte, as a tail call: this append's own ret returns straight to our
  // caller, so its advanced-cursor result and the A it leaves become this routine's result and A.
  return appendSoundCommandGated(m, TILE_FOURTH); // tail: its advanced-cursor result and A write are ours
}
