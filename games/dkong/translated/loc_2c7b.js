// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c7b  (ROM 0x2C7B–0x2C8E) — / loc_2c86 -- (the multi-entry SOURCES into entry_2c41).
 *
 *   2c7b  c6 02        add  a,0x02            ; loc_2c7b
 *   2c7d  b9           cp   c
 *   2c7e  ca 49 2c     jp   z,0x2c49
 *   2c81  3e 02        ld   a,0x02
 *   2c83  c3 4b 2c     jp   0x2c4b
 *   2c86  af           xor  a                 ; loc_2c86
 *   2c87  32 82 63     ld   (0x6382),a
 *   2c8a  3e 03        ld   a,0x03
 *   2c8c  c3 4f 2c     jp   0x2c4f
 *
 * These resolve entry_2c41's four entries. loc_2c7b (from entry_2c03's
 * jp c,0x2c7b): A += 2 (A is entry_2c03's `sub 0x02` result), then cp c -- if
 * A+2 == C it jumps to loc_2c49 (A kept -> the 0x6382=1/0x638f=2 path); else
 * A := 0x02 into loc_2c4b (-> 0x6382=2/0x638f=3). loc_2c86 (from entry_2c03's
 * AND entry_2c41's jp nz,0x2c86): CLEARS 0x6382 (xor a; ld (0x6382),a -- the
 * OPPOSITE of entry_2c72 which SETS bit 7, same byte inverse op),
 * then A := 0x03 into loc_2c4f (-> 0x638f=3, 0x6382 stays 0). Both TAIL-JUMP into
 * entry_2c41's body -- wired to the translated loc_2c49/loc_2c4b/loc_2c4f; no
 * ret here, entry_2c41's ret/skip handles the return. Not yet wired into the
 * live dispatcher (reached only from the dead entry_2c03/entry_2c41).
 *
 * NOTE the two `ld a,n`/`jp nn` pairs (0x2C81-83, 0x2C8A-8C) are TWO instructions
 * each -- both charged (the draft skeleton folded them into one m.step).
 */
export function loc_2c7b(m) {
  const { regs } = m;
  regs.add(0x02); // add a,0x02 -- A is entry_2c03's sub-0x02 result
  m.step(0x2c7d, 7); // add a,0x02
  regs.cp(regs.c); // cp c -- C = (0x62b1), the entry_2c03 live-in
  m.step(0x2c7e, 4); // cp c
  if (regs.fZ) {
    m.step(0x2c49, 10); // jp z,0x2c49 taken -- A+2 == C, A kept
    return m.call(0x2c49);
  }
  m.step(0x2c81, 10); // jp z,0x2c49 not taken
  regs.a = 0x02;
  m.step(0x2c83, 7); // ld a,0x02
  m.step(0x2c4b, 10); // jp 0x2c4b -- A = 0x02 into loc_2c4b
  return m.call(0x2c4b);
}
