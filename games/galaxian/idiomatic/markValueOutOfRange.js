// SPDX-License-Identifier: GPL-3.0-only
// markValueOutOfRange -- ROM 0x210a, grounding [seen].
// The saturate arm of a value clamp. Galaxian's tile-variant folder
// computeTileVariantFromTimer (ROM 0x211d) normally reduces register B to a
// 2-bit tile-variant index; but when its input is out of range (B >= 112) it
// branches here instead of folding, to pin B at a fixed out-of-range sentinel.
// This routine is that branch target: it slams B to the sentinel and returns
// the result. In the Z80 original this is the short `LD B,0x80` clamp tail.
// Live-out: register B = 0x80 (the sentinel); A and flags are left untouched.

// The saturation value B snaps to when the clamp input is out of range. 0x80
// (128) is the value the folder's callers recognise as "beyond range".
const CLAMP_SATURATION = 128;

export function markValueOutOfRange(m) {
  // Overwrite the fold index B with the sentinel and return it; the Z80 leaves
  // the value sitting in register B for the caller to read straight back.
  return (m.regs.b = CLAMP_SATURATION);
}
