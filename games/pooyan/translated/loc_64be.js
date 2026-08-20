// SPDX-License-Identifier: GPL-3.0-only

// loc_64be  (ROM 0x64be-0x64cf) -- terminator match-scan: walk mem[DE] (descending) against the
// table at (HL) (ascending) until a byte differs (NZ) or a fetched table byte decrements to zero.
// A mismatch bumps the counter at 0x8df9. Both exits share the tail `pop af` / `ret`: the pop
// discards the caller's own return, so control returns to the caller's caller (skip-return).
export function loc_64be(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(regs.de);        m.step(0x64bf, 7); // ld a,(de)
    regs.sub(mem.read8(regs.hl));       m.step(0x64c0, 7);
    if (regs.fNZ) { m.step(0x64ca, 12); break; } // jr nz,0x64ca -- mismatch
    m.step(0x64c2, 7); // jr nz not taken
    regs.de = (regs.de - 1) & 0xffff;   m.step(0x64c3, 6); // dec de
    regs.hl = (regs.hl + 1) & 0xffff;   m.step(0x64c4, 6); // inc hl
    regs.a = mem.read8(regs.hl);        m.step(0x64c5, 7);
    regs.a = regs.dec8(regs.a);         m.step(0x64c6, 4); // dec a
    if (regs.fZ) {
      m.step(0x64ce, 12); // jr z,0x64ce -- table entry hit 1 -> tail
      regs.af = m.pop16();              m.step(0x64cf, 10); // pop af -- drop caller return
      m.ret(); // ret -- to caller's caller
      return;
    }
    m.step(0x64be, 12); // jr 0x64be -- next byte
  }

  // loc_64ca: mismatch -> bump 0x8df9, then the shared pop-af/ret tail
  regs.hl = 0x8df9;                     m.step(0x64cd, 10); // ld hl,0x8df9
  regs.incMem8(mem, regs.hl);           m.step(0x64ce, 11); // inc (hl)
  regs.af = m.pop16();                  m.step(0x64cf, 10); // pop af -- drop caller return
  m.ret(); // ret -- to caller's caller
}
