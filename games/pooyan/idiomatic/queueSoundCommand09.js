// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommand09 — enqueue sound command 0x09 into the sound-command ring. [seen]
 *
 * WHAT IT IS
 *   A fixed-command selector at ROM 0x0f01-0x0f04. The machine has a small family of these
 *   one-line entry points, one per sound effect: each stands for a single command byte, and
 *   call sites pick the effect they want simply by calling the matching selector. This one
 *   stands for command 0x09.
 *
 * ROLE IN THE MACHINE
 *   The main CPU never drives the audio hardware directly. Instead it posts effect requests
 *   into a circular queue in shared work RAM — the sound-command ring — and the audio
 *   subsystem drains that queue on its own schedule. This selector is a producer for that
 *   ring: it does not talk to the audio processor, it only appends one byte for it to find.
 *   Naming the byte here (rather than at every call site) keeps the effect vocabulary in one
 *   place and lets the enqueue mechanics live in a single shared helper.
 *
 * GROUNDING
 *   [seen] — the role is confirmed: this is one of the distinct command bytes latched toward
 *   the audio side in play.
 *
 * LIVE-OUT
 *   Memory only. When it returns, the ring's tail slot holds 0x09 and the ring write pointer
 *   (SOUND_RING_WRITE_PTR, 0x8a40) has advanced one slot. Nothing else — no register value —
 *   is meant to be read back out; the command byte it emits is a compile-time constant.
 */

// The command byte this entry point stands for. Command 0x09 is a fixed selection: this
// selector always emits the same effect, so the value is a named constant rather than an
// argument. The enqueue helper writes exactly this byte into the ring's next free slot.
const SOUND_CMD_NINE = 0x09;

export function queueSoundCommand09(m) {
  // Hand the fixed command byte to the shared ring-enqueue helper: it stores 0x09 into the
  // slot the write pointer (SOUND_RING_WRITE_PTR, 0x8a40) names within the 28-slot ring
  // (SOUND_RING_BUFFER, 0x8a43-0x8a5e), then advances that pointer by one, wrapping the last
  // slot back to the first so the queue stays circular. The audio subsystem consumes from the
  // other end. All the ring bookkeeping is the helper's; this routine's only job is choosing
  // which effect to queue.
  enqueueSoundCommandRing(m, SOUND_CMD_NINE);
}
