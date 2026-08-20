// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeActorAnimationPointer — install a 16-bit script/animation pointer into an actor
 * record and reset the step byte that follows it.
 *
 * Writes the pointer little-endian (low at +0x0c, high at +0x0d) and clears the step/frame
 * index at +0x0e, so the actor begins its new script at step 0. PURE LEAF: three record
 * writes, calls nothing. LIVE-OUT: memory only — (iy+0x0c:0x0d) := pointer, (iy+0x0e) := 0.
 */
export function storeActorAnimationPointer(m, record = m.regs.iy, pointer = m.regs.de) {
  const { mem8 } = m;
  const base = record;

  mem8[base + 0x0c] = pointer;
  mem8[base + 0x0d] = pointer >> 8;
  mem8[base + 0x0e] = 0x00; // reset the step/frame index
}
