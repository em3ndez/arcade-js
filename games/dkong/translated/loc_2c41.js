// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c41  (ROM 0x2C41–0x2C71) — continuation of entry_2c03; MULTI-ENTRY.
 *
 *   2c41  cd 57 00     call 0x0057             ; loc_2c41
 *   2c44  e6 0f        and  0x0f
 *   2c46  c2 86 2c     jp   nz,0x2c86
 *   2c49  3e 01        ld   a,0x01             ; loc_2c49
 *   2c4b  32 82 63     ld   (0x6382),a         ; loc_2c4b
 *   2c4e  3c           inc  a
 *   2c4f  32 8f 63     ld   (0x638f),a         ; loc_2c4f
 *   2c52  3e 01        ld   a,0x01
 *   2c54  32 92 63     ld   (0x6392),a
 *   2c57  3a b2 62     ld   a,(0x62b2)
 *   2c5a  b9           cp   c
 *   2c5b  c0           ret  nz
 *   2c5c  d6 08        sub  0x08
 *   2c5e  32 b2 62     ld   (0x62b2),a
 *   2c61  11 20 00     ld   de,0x0020
 *   2c64  21 00 64     ld   hl,0x6400
 *   2c67  06 05        ld   b,0x05
 *   2c69  7e           ld   a,(hl)             ; loc_2c69
 *   2c6a  a7           and  a
 *   2c6b  ca 72 2c     jp   z,0x2c72
 *   2c6e  19           add  hl,de
 *   2c6f  10 f8        djnz 0x2c69
 *   2c71  c9           ret
 *
 * FOUR ENTRY POINTS: 0x2C41 (from entry_2c03, jp c + fall-through)
 * and loc_2c49 / loc_2c4b / loc_2c4f (from the untranslated entry_2c7b, with the
 * caller's A). Modelled as four exported functions chained by tail-calls so the
 * cluster can enter at any label. The store values differ by entry: via
 * 0x2C41/loc_2c49 (0x6382=1, 0x638f=2); via loc_2c4b (0x6382=A, 0x638f=A+1); via
 * loc_2c4f (0x638f=A only). 0x638f = 0x6382 + 1 because `inc a` @ 0x2C4E sits
 * BETWEEN the two stores. C is a live-in (entry_2c03's ld c,a).
 *
 * (0x62b2) is a gated RMW: proceeds past `ret nz` ONLY when (0x62b2)==C, then
 * (0x62b2) -= 8. loc_2c69 finds the FIRST ZERO of 5 records at
 * 0x6400 stride 0x20 (jp z). Flow-outs: 0x2c86 (jp nz,
 * untranslated -> NotImplemented) and entry_2c72 (jp z -- TRANSLATED, wired).
 * Not yet wired into the live dispatcher (its only in-partition caller entry_2c03
 * is itself unreached; the alt entries' source entry_2c7b is untranslated).
 */
export function loc_2c41(m) {
  const { regs } = m;

  m.push16(0x2c44);
  m.step(0x0057, 17); // call 0x0057
  m.call(0x0057); // translated -- A = (0x6018)+(0x601a)+(0x6019)
  regs.and(0x0f);
  m.step(0x2c46, 7); // and 0x0f
  if (regs.fNZ) {
    m.step(0x2c86, 10); // jp nz,0x2c86 taken (tail)
    return m.call(0x2c86);
  }
  m.step(0x2c49, 10); // jp nz,0x2c86 not taken
  return m.call(0x2c49);
}
