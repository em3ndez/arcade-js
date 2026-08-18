// SPDX-License-Identifier: GPL-3.0-only
/**
 * dequeueSoundCommand  —  ROM 0x07ac  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The consumer end of Frogger's software sound-command ring. The game never plays audio inline: every
 *   effect is first appended, as a one-byte command, to a FIFO in work RAM (see enqueueSoundCommand at
 *   the `rst 0x18` vector, 0x0018). This routine drains exactly ONE command off the front of that FIFO
 *   and hands it to the sound hardware. Running it once per frame is what paces the audio — no matter how
 *   many commands pile up in a single frame, at most one is delivered to the sound CPU per frame.
 *
 * WHERE IT SITS
 *   The pop side of the ring, run each in-play NMI (vblank) from the in-play service path. Its producer
 *   is enqueueSoundCommand (0x0018), called from all over gameplay (hop 0x04, fly-eat 0x18, jingles,
 *   tile-update 0x07, …); clearSoundQueue (0x07d9) wipes the whole ring at game start. This routine does
 *   the queue bookkeeping (decrement + shift) and delegates the actual hardware hand-off to
 *   issueSoundCommand (0x0794), the only place that touches the sound ports.
 *
 *   The ring is a plain FIFO: SOUND_QUEUE_COUNT (0x8300) holds the number of commands pending, and the 47
 *   bytes above it (slots 0x8301..0x832f) hold the queued command bytes, the i-th queued command living
 *   in slot i. So the FRONT of the queue is always slot 1 — SOUND_QUEUE_COUNT + 1 = 0x8301.
 *
 * LIVE-OUT
 *   Memory AND IO. In RAM it writes the decremented count and the shifted queue slots; through
 *   issueSoundCommand it also latches the command byte onto the sound-data port and strobes the sound
 *   CPU's interrupt line. It returns nothing and leaves no register the caller reads.
 */
import { SOUND_QUEUE_COUNT } from "./names.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

export function dequeueSoundCommand(m) {
  const { mem8 } = m;

  // ── Empty-queue fast path ────────────────────────────────────────────────────────────
  // SOUND_QUEUE_COUNT (0x8300) is the number of commands pending on the ring. On the great majority of
  // in-play frames nothing is queued, so this returns immediately without touching the hardware.
  const pending = mem8[SOUND_QUEUE_COUNT];
  if (pending === 0) return;

  // ── Consume one command from the count ───────────────────────────────────────────────
  // One command is about to leave the ring, so drop the pending count by one and publish it — next frame
  // sees one fewer. `pending` is at least 1 here, so `pending - 1` cannot underflow and no 8-bit wrap is
  // needed (unlike the enqueue side, whose increment can wrap).
  mem8[SOUND_QUEUE_COUNT] = pending - 1;

  // ── Issue the front command to the sound hardware ────────────────────────────────────
  // The FIFO front is slot 1: SOUND_QUEUE_COUNT + 1 = 0x8301, the oldest queued byte. Hand it to
  // issueSoundCommand (0x0794), which parks the byte on the sound-data port and pulses the sound CPU's
  // /INT so it wakes and plays the effect. We read the slot directly; decrementing the count above does
  // not disturb the slot contents, so the front byte is still intact.
  issueSoundCommand(m, mem8[SOUND_QUEUE_COUNT + 1]);

  // ── Shift the remaining queue down one slot ──────────────────────────────────────────
  // Slide every surviving command one slot toward the front so what was slot 2 becomes the new slot 1,
  // keeping the FIFO front anchored at 0x8301 for next frame. Each iteration copies slot (i+2) into slot
  // (i+1). The loop runs `pending` times — the ROM's byte-copy length — which is one iteration more than
  // the strictly-needed shift: the final pass drags the byte just above the queue down into the slot the
  // just-consumed command vacated. That slot now sits beyond the decremented count, so the extra copy is
  // harmless and this faithfully mirrors the oracle.
  for (let i = 0; i < pending; i++) {
    mem8[SOUND_QUEUE_COUNT + 1 + i] = mem8[SOUND_QUEUE_COUNT + 2 + i];
  }
}
