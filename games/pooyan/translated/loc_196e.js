// SPDX-License-Identifier: GPL-3.0-only

// loc_196e  (ROM 0x196e-0x19bb) -- gated multi-flag periodic driver. Bails while (0x8d55)!=0.
// (0x8902) selects a mode: <5 skips to the tail; ==5 arms a pair at 0x8d68/0x8d6a and fires
// loc_0f58; >5 records the value in (0x8d55) and fires loc_0f6c (both gated on (0x8d32)==0).
// Shared tail (loc_19a0): bails if (0x8d21) or (0x8f24) set, else runs a (0x8d22) countdown that
// on expiry reloads it to 0x20, sets (0x8d21)=1 and fires loc_0f76. loc_0f58/0f6c/0f76 are boundaries.
export function loc_196e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d55);      m.step(0x1971, 13);
  regs.and(regs.a);               m.step(0x1972, 4);
  if (regs.fNZ) return m.ret(11); // 1972  ret nz -- busy
  m.step(0x1973, 5);
  regs.a = mem.read8(0x8902);      m.step(0x1976, 13);
  regs.cp(0x05);                  m.step(0x1978, 7);

  if (regs.fC) {
    m.step(0x19a0, 12);           // 1978  jr c,0x19a0 (mode < 5) -> tail
  } else {
    m.step(0x197a, 7);            // jr c not taken
    if (regs.fZ) {
      m.step(0x198a, 12);         // 197a  jr z,0x198a (mode == 5)
      // loc_198a: arm the 0x8d68 pair, fire loc_0f58 (gated on 0x8d32 clear + slot free)
      regs.a = mem.read8(0x8d32);   m.step(0x198d, 13);
      regs.and(regs.a);            m.step(0x198e, 4);
      if (regs.fNZ) {
        m.step(0x1993, 12);        // 198e  jr nz,0x1993
      } else {
        m.step(0x1990, 7);         // jr nz not taken
        regs.hl = 0x8d68;          m.step(0x1993, 10);
      }
      // loc_1993
      regs.a = mem.read8(regs.hl);  m.step(0x1994, 7);
      regs.and(regs.a);            m.step(0x1995, 4);
      if (regs.fNZ) {
        m.step(0x19a0, 12);        // 1995  jr nz,0x19a0 -> tail (slot occupied)
      } else {
        m.step(0x1997, 7);         // jr nz not taken
        mem.write8(regs.hl, 0x01);       m.step(0x1999, 10);
        regs.l = regs.inc8(regs.l);      m.step(0x199a, 4);
        regs.l = regs.inc8(regs.l);      m.step(0x199b, 4);
        mem.write8(regs.hl, 0x01);       m.step(0x199d, 10);
        m.push16(0x19a0);
        m.step(0x0f58, 17);              // 199d  call 0x0f58 (boundary)
        m.call(0x0f58);
        // returns to 0x19a0 -> fall through to tail
      }
    } else {
      m.step(0x197c, 7);           // 197a  jr z not taken (mode > 5)
      // loc_197c: latch the new mode, fire loc_0f6c (gated on 0x8d32 clear)
      mem.write8(0x8d55, regs.a);   m.step(0x197f, 13);
      regs.a = mem.read8(0x8d32);   m.step(0x1982, 13);
      regs.and(regs.a);            m.step(0x1983, 4);
      if (regs.fNZ) {
        m.step(0x1988, 12);        // 1983  jr nz,0x1988
      } else {
        m.step(0x1985, 7);         // jr nz not taken
        m.push16(0x1988);
        m.step(0x0f6c, 17);        // 1985  call 0x0f6c (boundary)
        m.call(0x0f6c);
      }
      m.step(0x19a0, 12);          // 1988  jr 0x19a0 -> tail
    }
  }

  // loc_19a0: shared countdown tail
  regs.a = mem.read8(0x8d21);      m.step(0x19a3, 13);
  regs.and(regs.a);               m.step(0x19a4, 4);
  if (regs.fNZ) return m.ret(11); // 19a4  ret nz
  m.step(0x19a5, 5);
  regs.a = mem.read8(0x8f24);      m.step(0x19a8, 13);
  regs.and(regs.a);               m.step(0x19a9, 4);
  if (regs.fNZ) return m.ret(11); // 19a9  ret nz
  m.step(0x19aa, 5);
  regs.hl = 0x8d22;               m.step(0x19ad, 10);
  regs.a = mem.read8(regs.hl);     m.step(0x19ae, 7);
  regs.and(regs.a);               m.step(0x19af, 4);
  if (regs.fZ) {
    m.step(0x19b3, 12);           // 19af  jr z,0x19b3 (timer expired)
    mem.write8(regs.hl, 0x20);      m.step(0x19b5, 10);
    regs.l = regs.dec8(regs.l);     m.step(0x19b6, 4);
    mem.write8(regs.hl, 0x01);      m.step(0x19b8, 10);
    m.push16(0x19bb);
    m.step(0x0f76, 17);            // 19b8  call 0x0f76 (boundary)
    m.call(0x0f76);
    return m.ret(10);             // 19bb  ret
  }
  m.step(0x19b1, 7);              // jr z not taken
  regs.decMem8(mem, regs.hl);      m.step(0x19b2, 11); // 19b1  dec (hl)
  return m.ret(10);               // 19b2  ret
}
