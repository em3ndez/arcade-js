// SPDX-License-Identifier: GPL-3.0-only
//
// Worker->reader frame ring in shared memory: SLOTS buffers + a monotonic ctrl[C_COUNTER]. A 2-slot ring with
// a per-pixel shared-memory read tore frames when a stalled reader was overwritten mid-copy (junk lines, worst
// on vector games). snapshotFrame instead does one bulk copy + a seqlock re-check. Teeth: web/test/frame-tear.
export const SLOTS = 3;

// Writer: byte offset of the slot to fill for this frame counter.
export const writeBase = (counter, frameBytes) => (counter % SLOTS) * frameBytes;

// Reader: bulk-copy the last completed frame (counter-1) into private `snap` (the transform must read `snap`,
// never `fb`), then discard if the writer neared our slot. The writer fills THEN bumps, so the frame that
// overwrites slot (counter-1) is index counter+SLOTS-1 and the counter reads counter+SLOTS-1 while it fills:
// discard at advance >= SLOTS-1.
export function snapshotFrame(fb, snap, frameBytes, counter, loadCounter) {
  const base = (((counter - 1) % SLOTS) + SLOTS) % SLOTS * frameBytes;
  snap.set(fb.subarray(base, base + frameBytes));
  return loadCounter() - counter < SLOTS - 1;
}
