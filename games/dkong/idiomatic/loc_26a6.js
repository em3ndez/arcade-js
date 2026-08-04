// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_26a6 — step a mirrored pair of animation counters one frame, opposite ways.  ROM 0x26a6.
 *
 * The routine advances TWO one-byte counters that live 4 bytes apart — at P = HL+1
 * and P+4 — moving them in OPPOSITE directions and wrapping each within a 3-value
 * ring. A caller-supplied direction bit reverses both.
 *
 *   - `inc l` first steps HL onto the low counter cell P; the high cell is P+4,
 *     reached with `ld a,l / add a,0x04 / ld l,a`. Both address steps carry only L
 *     (8-bit), so H never changes and any low-byte wrap stays on the same page —
 *     faithful to the Z80 ops (which is why the wrap is on `(regs.l + n) & 0xff`).
 *   - The arm is chosen by bit 7 of the caller's select byte mem[DE] (`ld a,(de) /
 *     rla` puts that bit into carry; the rotated A is dead):
 *       bit7 = 0 → P counts UP   (wrap 0x53→0x50), P+4 counts DOWN (wrap 0xCF→0xD2)
 *       bit7 = 1 → P counts DOWN (wrap 0x4F→0x52), P+4 counts UP   (wrap 0xD3→0xD0)
 *     So P cycles through {0x50,0x51,0x52} and P+4 through {0xD0,0xD1,0xD2}. Each wrap
 *     is an exact-VALUE guard (`cp k / jp nz`), not a range clamp — an off-ring byte
 *     walks freely until it lands on the guard value. The two arms are inc/dec MIRRORS
 *     with the four constants inverted; a single dropped inc↔dec flip (3C vs 3D, same
 *     flags) would silently invert one counter's direction, so the arms are checked
 *     independently, not assumed symmetric.
 *
 * Three callers hand in HL = 0x69E4 / 0x69EC / 0x69F4 (sub_2602 / sub_262f→loc_264c /
 * sub_2679→tail_268d), so the counters land on the +1 (sprite code) bytes of three
 * consecutive sprite-record PAIRS in SPRITE_BUFFER (records 57/58, 59/60, 61/62).
 * Note {0xD0,0xD1,0xD2} == {0x50,0x51,0x52} | 0x80: the P+4 cell is the same tile as
 * P with the horizontal-flip bit set — i.e. a left/right MIRRORED sprite pair whose
 * shared 3-frame walk-cycle advances here, the flipped half a frame out of phase.
 * That reading is well-supported but the on-screen object/scene is unconfirmed, so the
 * routine keeps the neutral `loc_26a6` name and the targets stay hex (sprite-record
 * trap): a reviewer with corroboration can promote it (e.g. stepMirroredSpriteFrame).
 * A LEAF — reads mem[DE]/mem[P]/mem[P+4], writes P and P+4, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-26a6.test.js.
 * GATE:     exhaustive over the value logic — candidate == oracle over BOTH arms ×
 *           all 256×256 (mem[P],mem[P+4]) inputs (131,072 combos) — plus real captured
 *           dispatches (translated sub_2602/262f/2679 driven on a booted clone; both
 *           arms and all three HL bases occur) and crafted addressing edges (L-wrap
 *           base, the four wrap seams). Reachability: NOT reached in plain attract (0×)
 *           — a non-executing frontier under sub_25f2's object cascade — so real states
 *           are reproduced by running its translated callers, exactly like 0x3064.
 * LIVE-OUT: memory + A. Two RMW stores (P then P+4); A = the P+4 result, which loc_264c
 *           consumes (`and 0x7f` → 0x69ED) on the sub_262f path. Flags/HL/L are DEAD:
 *           every successor overwrites A's siblings before reading (loc_264c reloads HL;
 *           the other two arms `ret` into callees that clobber A/flags first).
 * NAMES:    none imported — HL/DE and both counters are caller-supplied; the routine
 *           references no fixed names.js address (the targets are SPRITE_BUFFER code bytes,
 *           addressed relatively, kept hex per the note above).
 */
export function loc_26a6(m) {
  const { regs, mem } = m;

  // `inc l` → P (low counter); `+4` more → P+4 (high counter). Low-byte only (H fixed).
  const page = regs.hl & 0xff00;
  const p = page | ((regs.l + 1) & 0xff);
  const p4 = page | ((regs.l + 5) & 0xff);

  // `ld a,(de) / rla`: carry = bit 7 of the select byte. Clear → P counts up; set → down.
  const countUpAtP = (mem.read8(regs.de) & 0x80) === 0;

  let result;
  if (countUpAtP) {
    stepRing(mem, p, +1, 0x53, 0x50); // P:   +1, wrap 0x53→0x50
    result = stepRing(mem, p4, -1, 0xcf, 0xd2); // P+4: −1, wrap 0xCF→0xD2
  } else {
    stepRing(mem, p, -1, 0x4f, 0x52); // P:   −1, wrap 0x4F→0x52
    result = stepRing(mem, p4, +1, 0xd3, 0xd0); // P+4: +1, wrap 0xD3→0xD0
  }

  // A is live-out (the P+4 result the caller reads); see LIVE-OUT.
  regs.a = result;
}

/**
 * Read-modify-write one ring counter: add `delta` (8-bit wrap, exactly `inc a`/`dec a`),
 * and if the result lands on the exact guard value `hitValue` replace it with `wrapTo`
 * (`cp k / jp nz / ld a,wrapTo`). Stores the byte and returns it.
 */
function stepRing(mem, addr, delta, hitValue, wrapTo) {
  let v = (mem.read8(addr) + delta) & 0xff;
  if (v === hitValue) v = wrapTo;
  mem.write8(addr, v);
  return v;
}
