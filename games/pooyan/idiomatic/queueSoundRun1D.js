// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSoundRun1D — play the end-of-phase sound cue by queuing the fixed run that leads with 0x1d.
 *
 * WHAT IT IS
 *   The thin producer for one specific sound: the cue emitted when a round's phase gauge has
 *   drained to zero. All it does is fix the run's leading command byte at 0x1d and hand off to the
 *   shared sound-command-run appender, which does the actual enqueuing.
 *
 * ITS ROLE IN THE MACHINE
 *   The audio side is fed through a small circular ring buffer in the 0x8a00 page — the 28-slot
 *   sound-command ring (SOUND_RING_BUFFER, 0x8a43), addressed by the write cursor
 *   SOUND_RING_WRITE_PTR (0x8a40). Game events don't latch a sound directly; they drop command
 *   bytes into this ring, and the per-frame service pays them out one at a time to the audio
 *   processor. A "run" is a short multi-byte command: a chosen leading byte followed by the fixed
 *   three-byte trailer 0x15, 0x16, 0x17 that frames and terminates the run for the reading side.
 *   This routine is the producer for exactly one such run — the one whose lead byte is 0x1d. Its
 *   single caller is the phase-exhausted handler advancePlayStateThenInsertHighScore, reached when
 *   the visible phase gauge (GAUGE_PHASE_COUNTER, 0x8908) empties and the playable part of the
 *   round ends; queuing this run is the first thing that handler does, so the cue accompanies the
 *   transition into the round teardown.
 *
 * ROM 0x0f92-0x0f96. Grounding tag: [seen].
 *
 * LIVE-OUT: A = the advanced ring write-cursor left by the run appender's final append (0 when the
 * play-live gate is closed and the four bytes were dropped in attract / between lives). Here A is
 * set but not consumed — the immediate caller reloads A before it reads it.
 */

// The fixed leading command byte this routine supplies for its run. The run appender enqueues it as
// the head of the sequence and then appends the fixed 0x15/0x16/0x17 trailer behind it.
const LEAD_TILE = 0x1d; // the run's caller-supplied lead tile

export function queueSoundRun1D(m) {
  // Load the fixed lead byte 0x1d and hand off to the sound-command-run appender at ROM 0x0fc3
  // (the ROM reaches it by a plain jump, so the appender returns straight to this routine's caller).
  // The appender queues the four-byte run — 0x1d then the 0x15/0x16/0x17 trailer — through the shared
  // play-live gate, so the whole run is either fully enqueued (while a game is running) or fully
  // dropped (in attract), never split. Its result — the advanced ring write-cursor — becomes ours.
  return appendSoundCommandRun(m, LEAD_TILE);
}
