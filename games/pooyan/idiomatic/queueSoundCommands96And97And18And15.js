// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands96And97And18And15 — a fixed four-byte batch producer for the sound-command
 * ring. It queues four constant command bytes, in order (0x96, 0x97, 0x18, 0x15), for the audio
 * subsystem to pick up later. Straight-line, no branches; every byte is a constant.
 *
 * WHAT IT IS
 *   One of a large family of tiny "selector" routines. The main CPU never plays a sound directly:
 *   it accumulates one-byte commands in a small circular queue — the sound-command ring, which
 *   lives on page 0x8a — and the frame service pays exactly one byte per frame out to the audio
 *   processor. Each selector names a specific sound (or short sequence) as fixed bytes and drops
 *   them into that ring. This one queues the particular four-byte batch 0x96, 0x97, 0x18, 0x15.
 *
 * ROLE IN THE MACHINE
 *   Pure producer. It appends to the tail of the ring and returns; the actual hand-off to the audio
 *   processor happens elsewhere, once per frame, as the ring is drained from its head. All four
 *   bytes are sound-command bytes, but they reach the ring through two different writers:
 *     - appendSoundCommandGated — the play-GATED writer. It enqueues only while a game is live:
 *       either the in-play flag GAME_ACTIVE_FLAG (0x8806) is set, or the play-mode latch
 *       PLAY_MODE_LATCH (0x8f50) is nonzero. With both clear (attract, or between lives) the byte
 *       is dropped and nothing is queued.
 *     - enqueueSoundCommandRing — the UNCONDITIONAL writer. It always appends, whatever the game
 *       state.
 *   Both writers target the same buffer through the same one-byte write cursor
 *   (SOUND_RING_WRITE_PTR, 0x8a40) over the same slots (0x8a43..0x8a5e), so the four bytes join a
 *   single interleaved stream regardless of which writer placed each one.
 *
 * ROM 0x0f58-0x0f6b. [seen].
 *
 * LIVE-OUT: memory only — up to four slots of the sound-command ring filled and the write cursor
 * advanced. If play is not live the first two (gated) bytes are dropped, so only 0x18 and 0x15
 * land. No register result is consumed by callers.
 */

// The four fixed command bytes, listed in the order they enter the ring. The identifiers group
// them by which writer carries each pair — the first pair rides the gated writer, the second pair
// the unconditional writer (see the steps below) — not by any difference in destination: all four
// are sound-command bytes and all four land in the one sound-command ring on page 0x8a.
const TEXT_BYTE_A = 0x96;
const TEXT_BYTE_B = 0x97;
const SOUND_BYTE_A = 0x18;
const SOUND_BYTE_B = 0x15;

export function queueSoundCommands96And97And18And15(m) {
  // Steps 1-2: queue 0x96 then 0x97 through the play-gated writer. Each call stashes its byte at
  // SOUND_RING_PENDING_BYTE (0x8d20), then tests the gate (GAME_ACTIVE_FLAG 0x8806 /
  // PLAY_MODE_LATCH 0x8f50); only if play is live does it store the byte into the slot named by the
  // write cursor (0x8a40) and advance that cursor, wrapping the last ring slot (0x5e) back to the
  // first (0x43). With both gate cells clear these two bytes are silently dropped.
  appendSoundCommandGated(m, TEXT_BYTE_A);
  appendSoundCommandGated(m, TEXT_BYTE_B);
  // Steps 3-4: queue 0x18 then 0x15 through the unconditional writer. These always append: each
  // stores its byte into the slot the write cursor (0x8a40) points at and advances the cursor with
  // the same 0x5e->0x43 wrap, regardless of game state. So even in the attract/between-lives case
  // where the gated pair above is dropped, these two still enter the ring.
  enqueueSoundCommandRing(m, SOUND_BYTE_A);
  enqueueSoundCommandRing(m, SOUND_BYTE_B);
}
