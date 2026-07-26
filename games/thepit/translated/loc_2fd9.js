// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fd9  (ROM 0x2fd9-0x2fdd, The Pit) -- commits the just-computed byte in A
 * to (0x80dc), then TAIL-JUMPS into the shared update tail at loc_2fe3.
 *
 * This is the two-state commit tail of the animation toggler above it
 * (loc_2fc0): that code puts either 0x38 (when (0x80dc) != 0x38) or 0x39 (when
 * (0x80dc) == 0x38) into A, and both arms land here -- the `jr nz,0x2fd9` and
 * the fall-through -- so (0x80dc) alternates 0x38 <-> 0x39. This routine's own
 * job is just the store plus the continuation; the toggle decision was made by
 * the caller. (0x80dc) is work RAM (0x8000-0x87ff), so its write takes no
 * write-bus offset.
 *
 * The `jr 0x2fe3` is UNCONDITIONAL; this routine has NO ret of its own, so
 * loc_2fe3's ret returns to OUR caller. Modelled per the thepit tail-jump
 * convention (loc_2f2f / loc_02a1): `m.step(target, 12); return m.call(target)`
 * with no trailing m.ret (a call+ret would push a spurious frame and double-pop).
 * loc_2fe3 is its own ROM routine (also fallen into from loc_2fde), so the jump
 * resolves through the registry.
 * (Role is best-effort from the code; the address, store and control flow are exact.)
 *
 * loc_2fd9:
 *   2fd9  32 dc 80     ld   (0x80dc),a
 *   2fdc  18 05        jr   0x2fe3
 */
export function loc_2fd9(m) {
  const { regs, mem } = m;

  // 2fd9  ld (0x80dc),a -- commit the caller's toggled tile byte (0x38/0x39)
  mem.write8(0x80dc, regs.a);
  m.step(0x2fdc, 13);
  // 2fdc  jr 0x2fe3 -- unconditional tail-jump; loc_2fe3's ret returns to OUR caller
  m.step(0x2fe3, 12);
  return m.call(0x2fe3);
}
