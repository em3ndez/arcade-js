// SPDX-License-Identifier: GPL-3.0-only

// loc_1b80  (ROM 0x1b80-0x1b8a) -- +8 copy loop. Reads bytes from (DE); a 0xa0 byte is the
// terminator (`ret z` -- the only exit). Each other byte is written to (HL) after adding 0x08,
// then DE and HL advance and the loop repeats via the unconditional `jr 0x1b80`. Entered by
// loc_1b43 falling through with DE=0x1ff2 / HL=0x89f0. The lone `ret` at 0x1b8b sits past the
// unconditional jr and is not part of this routine.
export function loc_1b80(m) {
  const { regs, mem } = m;

  for (;;) { // loc_1b80: copy the next byte until the 0xa0 terminator
    regs.a = mem.read8(regs.de);      m.step(0x1b81, 7);
    regs.cp(0xa0);                    m.step(0x1b83, 7);
    if (regs.fZ) { m.ret(11); return; } // 1b83  ret z -- terminator
    m.step(0x1b84, 5);                // ret z not taken
    regs.add(0x08);                   m.step(0x1b86, 7);
    mem.write8(regs.hl, regs.a);      m.step(0x1b87, 7);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1b88, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1b89, 6);
    m.step(0x1b80, 12);               // 1b89  jr 0x1b80 (loop back)
  }
}
