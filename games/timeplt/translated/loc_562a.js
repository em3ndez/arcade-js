// SPDX-License-Identifier: GPL-3.0-only

// loc_562a  (ROM 0x562A-0x5633, Time Pilot)
export function loc_562a(m) {
  const { regs, mem } = m;

  regs.hl = 0xac43;
  m.step(0x562d, 10); // 562a  ld hl,0xac43
  regs.incMem8(mem, regs.hl);
  m.step(0x562e, 11); // 562d  inc (hl) -- advance the write index
  regs.a = mem.read8(regs.hl);
  m.step(0x562f, 7); // 562e  ld a,(hl) -- A = the new index

  m.push16(0x5630);
  m.step(0x0008, 11); // 562f  rst 0x08 -- HL += A, A = (HL); returns to 0x5630
  m.call(0x0008);

  regs.af = m.pop16();
  m.step(0x5631, 10); // 5630  pop af -- the byte the entry prologue pushed

  mem.write8(regs.hl, regs.a);
  m.step(0x5632, 7); // 5631  ld (hl),a -- store at 0xac43 + index

  regs.hl = m.pop16();
  m.step(0x5633, 10); // 5632  pop hl -- the caller's HL

  m.ret(10); // 5633  ret
}
