// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSoundQueue  —  ROM 0x07d9  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The game-start reset of the sound-command queue. Frogger does not play audio directly: it hands
 *   commands to a second (sound) CPU through a single FIFO ring in shared RAM. This routine wipes that
 *   whole ring back to empty so a fresh game starts with no stale sound commands pending.
 *
 * WHERE IT SITS
 *   Called once during new-game setup (startNewGame), right before the start jingle is enqueued. It is a
 *   one-shot initialiser — NOT part of the per-frame audio loop. The per-frame players are its siblings:
 *   enqueueSoundCommand (0x0018) pushes a command onto the ring and dequeueSoundCommand (0x07ac) drains
 *   one command per in-play frame. This routine simply zeroes what those two operate on.
 *
 * THE RING IT CLEARS
 *   The ring lives in a contiguous 48-byte region beginning at SOUND_QUEUE_COUNT (0x8300):
 *     - 0x8300         : the pending-command COUNT (how many commands are queued right now)
 *     - 0x8301..0x832f : the 47 command SLOTS, slot i holding the i-th queued command byte
 *   Zeroing the count byte marks the ring empty; zeroing the 47 slots clears any leftover command bytes.
 *   The region is exactly 0x8300..0x832f inclusive.
 *
 * LIVE-OUT
 *   Memory only. It writes 48 zero bytes and nothing else — no return value, no register the caller reads.
 */
import { SOUND_QUEUE_COUNT } from "./names.js";

// Size of the sound-command ring in bytes: the 1 pending-count byte at SOUND_QUEUE_COUNT (0x8300) plus
// the 47 command slots above it (0x8301..0x832f). Clearing this many bytes empties the ring completely.
const QUEUE_REGION_BYTES = 48;

export function clearSoundQueue(m) {
  const { mem8 } = m;

  // ── Empty the ring ───────────────────────────────────────────────────────────────────
  // Walk the whole region from the count byte upward and zero every cell. Writing 0 to the count byte
  // (0x8300) declares the queue empty; the remaining writes scrub any stale command bytes out of the 47
  // slots so the new game cannot inherit sounds from the previous one.
  for (let i = 0; i < QUEUE_REGION_BYTES; i++) mem8[SOUND_QUEUE_COUNT + i] = 0;
}
