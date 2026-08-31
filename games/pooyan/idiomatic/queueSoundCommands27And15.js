// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands27And15 — request two fixed sounds, 0x27 then 0x15, in that order. [seen]
 *
 * WHAT IT IS
 *   A tiny composite sound request. The main CPU never drives the audio hardware directly;
 *   instead it posts numbered command bytes into a small circular queue in shared work RAM and
 *   lets the audio subsystem pull them out and play them. Most callers post a single command.
 *   This one posts a pair — command 0x27 immediately followed by command 0x15 — so one game
 *   event triggers a two-part sound sequence rather than a single tone.
 *
 * ROLE IN THE MACHINE
 *   Whatever game event maps to this routine wants two distinct sounds to sound back-to-back.
 *   Because both bytes go through the same tail pointer, the queue preserves their order: the
 *   audio side, which drains the queue from the opposite end, sees 0x27 first and 0x15 second.
 *   The two command bytes are the whole payload — no arguments, no branching, no state to read.
 *
 * ROM 0x0fb2-0x0fbb. The two commands are hard-coded immediates; this routine has no inputs.
 *
 * LIVE-OUT: none in registers — the result lives entirely in memory. Two slots of the
 *   sound-command ring are filled and its write pointer is advanced twice (see below). The
 *   enqueue helper leaves the ring index in A, but callers reload A before using it, so A is
 *   not a meaningful result of this routine.
 */

// The two sound-command byte values, posted in this fixed order. They are opaque identifiers
// consumed by the audio subsystem; 0x27 is requested first, 0x15 second.
const SOUND_CMD_FIRST = 0x27;
const SOUND_CMD_SECOND = 0x15;

export function queueSoundCommands27And15(m) {
  // Step 1: post the first sound command (0x27). enqueueSoundCommandRing drops the byte into
  // the ring's current tail slot (SOUND_RING_BUFFER at 0x8a43..0x8a5e) and bumps the write
  // pointer (SOUND_RING_WRITE_PTR, 0x8a40) one slot forward, wrapping the last slot to the
  // first. This request is now queued for the audio subsystem.
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);

  // Step 2: post the second sound command (0x15) the same way. Because Step 1 already advanced
  // the tail, this byte lands in the next slot behind 0x27, so the two commands stay in order
  // in the queue and will be played in that sequence.
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}
