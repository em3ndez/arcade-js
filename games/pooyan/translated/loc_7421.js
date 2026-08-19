// SPDX-License-Identifier: GPL-3.0-only

// loc_7421  (ROM 0x7421-0x7441) -- bonus phase 2 (teardown). While the (0x8f36) hold is non-zero it
// ticks it and returns. On expiry it clears the 9-byte phase block at 0x8f37 and the 0x48-byte record
// region at 0x8ae0 (both via rst 0x10 with A=0), zeroes (0x880a)/(0x8f5b) and sets the attract-state
// selector (0x8e51)=7, handing control back out of the bonus stage.
export function loc_7421(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f36;
  m.step(0x7424, 10); // 7421  ld hl,0x8f36
  regs.a = mem.read8(regs.hl);
  m.step(0x7425, 7); // 7424  ld a,(hl)
  regs.and(regs.a);
  m.step(0x7426, 4); // 7425  and a
  if (regs.fNZ) {
    m.step(0x7428, 7); // 7426  jr z,0x742a (not taken)
    regs.decMem8(mem, regs.hl);
    m.step(0x7429, 11); // 7428  dec (hl)
    m.ret(); // 7429  ret
    return;
  }
  m.step(0x742a, 12); // 7426  jr z,0x742a

  regs.hl = 0x8f37;
  m.step(0x742d, 10); // 742a  ld hl,0x8f37
  regs.b = 0x09;
  m.step(0x742f, 7); // 742d  ld b,0x09
  m.push16(0x7430);
  m.step(0x0010, 11); // 742f  rst 0x10 -- clear 9 bytes at 0x8f37 (A=0)
  m.call(0x0010);
  regs.hl = 0x8ae0;
  m.step(0x7433, 10); // 7430  ld hl,0x8ae0
  regs.b = 0x48;
  m.step(0x7435, 7); // 7433  ld b,0x48
  m.push16(0x7436);
  m.step(0x0010, 11); // 7435  rst 0x10 -- clear 0x48 bytes at 0x8ae0 (A=0)
  m.call(0x0010);
  mem.write8(0x880a, regs.a);
  m.step(0x7439, 13); // 7436  ld (0x880a),a
  mem.write8(0x8f5b, regs.a);
  m.step(0x743c, 13); // 7439  ld (0x8f5b),a
  regs.a = 0x07;
  m.step(0x743e, 7); // 743c  ld a,0x07
  mem.write8(0x8e51, regs.a);
  m.step(0x7441, 13); // 743e  ld (0x8e51),a
  m.ret(); // 7441  ret
}
