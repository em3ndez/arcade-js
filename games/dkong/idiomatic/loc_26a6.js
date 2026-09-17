// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_26a6 — step a mirrored pair of sprite tile-code counters (P and P+4, one past the base) one
 * frame in OPPOSITE directions, each wrapping within its 3-value ring on an exact-value guard.
 * Bit 7 of the select byte reverses both arms. Both steps move the low byte only, so wraps at
 * 8 bits and the page is fixed.
 *
 * LIVE-OUT: memory — the two counters — plus the P+4 result, which the caller reads back.
 */
export function loc_26a6(m, hl = m.regs.hl, l = m.regs.l, de = m.regs.de) {
  const { regs, mem8 } = m;

  const page = hl & 0xff00;
  const p = page | ((l + 1) & 0xff);
  const p4 = page | ((l + 5) & 0xff);

  const countUpAtP = (mem8[de] & 0x80) === 0;

  let result;
  if (countUpAtP) {
    stepRing(mem8, p, +1, 0x53, 0x50);
    result = stepRing(mem8, p4, -1, 0xcf, 0xd2);
  } else {
    stepRing(mem8, p, -1, 0x4f, 0x52);
    result = stepRing(mem8, p4, +1, 0xd3, 0xd0);
  }

  regs.a = result;
}

/**
 * Read-modify-write one ring counter: add `delta` with an 8-bit wrap, and if the result lands on
 * the exact guard value `hitValue`, replace it with `wrapTo`. Stores the byte and returns it.
 */
function stepRing(mem8, addr, delta, hitValue, wrapTo) {
  let v = (mem8[addr] + delta) & 0xff;
  if (v === hitValue) v = wrapTo;
  mem8[addr] = v;
  return v;
}
