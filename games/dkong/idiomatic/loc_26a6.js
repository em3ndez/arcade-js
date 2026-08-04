// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_26a6 — step a mirrored pair of animation counters one frame, in opposite directions.
 *
 * It advances TWO one-byte counters that live 4 bytes apart — call them P and P+4, where P is one
 * past the caller-supplied base — moving them in OPPOSITE directions and wrapping each within a
 * 3-value ring. A caller-supplied direction bit reverses both.
 *
 *   - Both address steps move only the low byte of the pointer, so the page never changes and a
 *     low-byte wrap stays on the same page. That is why the arithmetic below wraps at 8 bits.
 *   - The arm is chosen by bit 7 of the caller's select byte:
 *       bit7 = 0 → P counts UP   (wrap 0x53→0x50), P+4 counts DOWN (wrap 0xCF→0xD2)
 *       bit7 = 1 → P counts DOWN (wrap 0x4F→0x52), P+4 counts UP   (wrap 0xD3→0xD0)
 *     So P cycles through {0x50,0x51,0x52} and P+4 through {0xD0,0xD1,0xD2}. Each wrap is an
 *     exact-VALUE guard, not a range clamp — a byte that starts off the ring walks freely until it
 *     happens to land on the guard value. The two arms are increment/decrement MIRRORS with the
 *     four constants inverted, and a single dropped flip between them would silently reverse one
 *     counter, so the arms are checked independently rather than assumed symmetric.
 *
 * The two counters are sprite tile-code bytes, and the pair is not arbitrary:
 * {0xD0,0xD1,0xD2} is {0x50,0x51,0x52} with the horizontal-flip bit set, so P+4 shows the same
 * tile as P, mirrored. What advances here is one 3-frame walk cycle shared by a left/right
 * mirrored sprite pair, the flipped half a frame out of phase with the other.
 *
 * NOT CLAIMED: which on-screen object or scene that pair belongs to. The mirroring is visible in
 * the constants; the object is not.
 *
 * A LEAF — it reads the select byte and the two counters, writes the two counters, and calls
 * nothing.
 *
 * LIVE-OUT: memory — the two counters — plus the P+4 result, which the caller reads back.
 */
export function loc_26a6(m) {
  const { regs, mem } = m;

  // One past the base is P, the low counter; four beyond that is P+4. Both steps move the low
  // byte only, so the page is fixed.
  const page = regs.hl & 0xff00;
  const p = page | ((regs.l + 1) & 0xff);
  const p4 = page | ((regs.l + 5) & 0xff);

  // Bit 7 of the select byte picks the arm: clear → P counts up; set → P counts down.
  const countUpAtP = (mem.read8(regs.de) & 0x80) === 0;

  let result;
  if (countUpAtP) {
    stepRing(mem, p, +1, 0x53, 0x50); // P:   +1, wrap 0x53→0x50
    result = stepRing(mem, p4, -1, 0xcf, 0xd2); // P+4: −1, wrap 0xCF→0xD2
  } else {
    stepRing(mem, p, -1, 0x4f, 0x52); // P:   −1, wrap 0x4F→0x52
    result = stepRing(mem, p4, +1, 0xd3, 0xd0); // P+4: +1, wrap 0xD3→0xD0
  }

  // The P+4 result is live-out: the caller reads it back.
  regs.a = result;
}

/**
 * Read-modify-write one ring counter: add `delta` with an 8-bit wrap, and if the result lands on
 * the exact guard value `hitValue`, replace it with `wrapTo`. Stores the byte and returns it.
 */
function stepRing(mem, addr, delta, hitValue, wrapTo) {
  let v = (mem.read8(addr) + delta) & 0xff;
  if (v === hitValue) v = wrapTo;
  mem.write8(addr, v);
  return v;
}
