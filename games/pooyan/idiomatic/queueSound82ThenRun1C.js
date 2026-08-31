// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSound82ThenRun1C — a sound-command trampoline.
 *
 * WHAT IT IS
 *   A tiny two-step emitter that pushes a fixed sound-command sequence into the machine's
 *   sound-command ring: first one standalone lead byte (0x82), then a complete framed four-byte
 *   run led by 0x1c. Together those queue five command bytes in order — 0x82, then 0x1c, 0x15,
 *   0x16, 0x17 — into the ring the audio side reads.
 *
 * ITS ROLE IN THE MACHINE
 *   Sound is not latched the instant a game event asks for it. Instead a crowd of thin emitters
 *   drop command bytes into a small 28-slot circular buffer in the 0x8a page (the sound-command
 *   ring headed by SOUND_RING_WRITE_PTR at 0x8a40), and the per-frame heartbeat pays those bytes
 *   out one per frame to the audio processor. This particular sequence is fired when an actor group
 *   is spawned, to voice that spawn: it lays down the opening command byte on its own, then a fully
 *   framed run whose fixed trailer (0x15/0x16/0x17) tells the far side the run is complete.
 *
 *   Both appends funnel through the one shared, GATED helper, so the whole sequence obeys the same
 *   play-live gate: while a game is running (GAME_ACTIVE_FLAG set) or the play-state latch
 *   (PLAY_MODE_LATCH) is nonzero the bytes are enqueued, and while the machine is idle (attract /
 *   between lives) they are all dropped.
 *
 * ROM 0x0f88-0x0f91. Grounding tag: [seen].
 *
 * LIVE-OUT: A = the advanced ring write-cursor after the final append (0 when the play gate is
 * closed and the bytes were dropped). It comes straight from the run builder, whose result rides
 * back out as this routine's own result.
 */
const OPEN_TILE = 0x82; // the opening command byte, appended first on its own
const RUN_INDEX = 0x1c; // the leading byte of the four-byte sound-command run (trailer 0x15/0x16/0x17)

export function queueSound82ThenRun1C(m) {
  // Step 1: append the lone opening command byte (0x82) through the shared gated helper (ROM 0x0ea2),
  // which writes it into the ring slot under SOUND_RING_WRITE_PTR and advances the cursor — but only
  // while play is live; if the gate is closed this byte is dropped and nothing is enqueued.
  appendSoundCommandGated(m, OPEN_TILE);
  // Step 2: append the framed four-byte run led by 0x1c (ROM 0x0fc3): the leading byte followed by
  // the fixed terminator 0x15/0x16/0x17, each byte passing through the same gate so the run is either
  // fully queued or fully dropped — never truncated. Its result (the advanced ring write-cursor, or 0
  // if the gate is closed) is this routine's live-out in A.
  return appendSoundCommandRun(m, RUN_INDEX);
}
