// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0E — one of the sound-command emitters: the entry point that stands for the
 * fixed command byte 0x0e and drops it into the sound-command ring.
 *
 * ROM 0x0f19-0x0f1c. [seen].
 *
 * WHAT IT IS / ROLE IN THE MACHINE:
 *   The audio side is driven by a small ring buffer in the 0x8a page — the 28-slot sound-command
 *   ring headed by SOUND_RING_WRITE_PTR (0x8a40) over SOUND_RING_BUFFER (0x8a43). Game logic never
 *   talks to the audio processor directly; it enqueues one-byte command codes here, and the frame
 *   service drains the ring once per beat and forwards each queued byte to the audio side to be
 *   played. A whole crowd of thin, near-identical emitters exists — one per sound the game can ask
 *   for — and each differs only in the single constant byte it enqueues. This is the emitter for
 *   command 0x0e.
 *
 * HOW IT WORKS:
 *   It loads its one fixed command code and falls straight through into the shared gated append
 *   routine, appendSoundCommandGated, which performs the entire job: it stashes the incoming byte,
 *   tests the play gates (GAME_ACTIVE_FLAG at 0x8806 set, OR the play-mode latch PLAY_MODE_LATCH at
 *   0x8f50 nonzero), and only while play is live writes the byte at the ring write cursor and steps
 *   that cursor forward (wrapping the last slot back to the first). With both gates clear — attract,
 *   or between lives — the byte is silently dropped. This entry contributes nothing of its own
 *   beyond selecting which byte gets appended.
 *
 * LIVE-OUT: A = the advanced ring write cursor the append leaves behind (0 on the gates-closed path,
 * where nothing is enqueued). The shared routine leaves that cursor in A and does not restore the
 * prior A, so a caller that wants the result can read A back.
 */

// The fixed sound-command code this emitter stands for. It is the only thing that distinguishes
// this entry from its siblings; the ring write, the play-gate test and the cursor advance are all
// shared downstream.
const RING_BYTE = 0x0e; // the byte this entry appends

export function queueSoundCommand0E(m) {
  // Emit: hand the fixed command byte to the shared gated-append routine and pass its result
  // straight back. The gate test, the write into the 0x8a-page ring, the cursor advance, and the
  // returned cursor value are this emitter's whole effect.
  return appendSoundCommandGated(m, RING_BYTE);
}
