// SPDX-License-Identifier: GPL-3.0-only

// loc_611f  (ROM 0x611f-0x613c) -- find the actor record matching key A. HL+=DE, A=(hl) is the key;
// scan 6 records at IY=0x8ae0 (stride 0x18) comparing A with (iy+0x14). On a match tail-jump loc_613d.
// No match: 0x8d44==3 -> ret; else call 0x0ef1 and ret.
export function loc_611f(m) {
  const { regs, mem } = m;

  regs.addHl(regs.de);               m.step(0x6120, 11);
  regs.a = mem.read8(regs.hl);       m.step(0x6121, 7);
  regs.b = 0x06;                     m.step(0x6123, 7);
  regs.de = 0x0018;                  m.step(0x6126, 10);
  regs.iy = 0x8ae0;                  m.step(0x612a, 14);

  for (;;) { // 0x612a: scan up to 6 records
    regs.cp(mem.read8((regs.iy + 0x14) & 0xffff)); m.step(0x612d, 19);
    if (regs.fZ) { m.step(0x613d, 12); return m.call(0x613d); } // jr z tail -> loc_613d
    m.step(0x612f, 7);               // jr z not taken
    regs.addIy(regs.de);             m.step(0x6131, 15);
    if (regs.djnz()) { m.step(0x612a, 13); } else { m.step(0x6133, 8); break; }
  }

  regs.a = mem.read8(0x8d44);        m.step(0x6136, 13);
  regs.cp(0x03);                     m.step(0x6138, 7);
  if (regs.fZ) { return m.ret(11); } // ret z
  m.step(0x6139, 5);                 // ret z not taken
  m.push16(0x613c);
  m.step(0x0ef1, 17);                // call 0x0ef1
  m.call(0x0ef1);
  return m.ret(10);                  // 613c  ret
}
