// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands19And15 — post the fixed pair of sound commands 0x19 then 0x15.
 *
 * WHAT IT IS
 *   A fixed-payload sound emitter. Every time it runs it posts exactly two request
 *   bytes — 0x19 first, 0x15 second — and nothing else. There is no branching and no
 *   parameter; the pair and their order are baked in.
 *
 * ROLE IN THE MACHINE
 *   The main CPU never drives the audio hardware directly. Instead it drops request
 *   bytes into a small circular queue in shared work RAM — the sound-command ring — and
 *   the audio subsystem drains that queue at its own pace, one byte per frame. A caller
 *   that wants a particular sound effect simply appends the corresponding command byte
 *   to the ring's tail and moves on; it never waits. This routine is one of several
 *   fixed emitters that always append the same command(s), so a single call cues a
 *   known two-part sound sequence.
 *
 *   Because the ring is drained in first-in / first-out order, posting 0x19 ahead of
 *   0x15 guarantees the audio side handles 0x19 before 0x15 — the order of these two
 *   appends is the order the sounds are serviced.
 *
 * ROM 0x0f6c-0x0f75.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only — the two newly filled ring slots and the twice-advanced write
 * pointer. Each append clobbers A internally, but every caller reloads A for its own
 * next use, so A is not a consumed output of this routine.
 */

// The two command bytes, appended in this order. These are opaque selector IDs that the
// audio subsystem interprets when it drains the ring; here they are only payload to be
// queued, so their numeric values are all that matter.
const SOUND_CMD_FIRST = 0x19;
const SOUND_CMD_SECOND = 0x15;

export function queueSoundCommands19And15(m) {
  // Step 1 — append 0x19 at the ring tail.
  // The enqueuer stores the byte into the slot pointed at by SOUND_RING_WRITE_PTR
  // (0x8a40) within the 28-slot ring at SOUND_RING_BUFFER (0x8a43..0x8a5e), then bumps
  // the write pointer one slot forward (wrapping 0x5e back to 0x43). This is the first
  // and earlier-serviced half of the pair.
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);

  // Step 2 — append 0x15 at the (now advanced) ring tail.
  // Same mechanism, landing in the slot immediately after 0x19 and advancing the write
  // pointer again. Sitting behind 0x19 in the FIFO, it is the second sound the audio
  // side services.
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}
