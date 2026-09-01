// SPDX-License-Identifier: GPL-3.0-only
// loc_028e (ROM 0x028e-0x02ec + interior 0x032c/0x033b-0x03b8) -- pchl-dispatch object handler: pop the
// record pointer, count down its timer; on expiry rebuild the sprite + advance its animation, else fall
// through into loc_02ed. Forward-branch targets are nested fns; doE (0x036f) is the shared ret tail.
export function loc_028e(m) {
  const { regs, mem } = m;

  function doE() { // 036f -- shared ret tail
    regs.hl = 0x2018; m.step(0x0372, 10);
    m.push16(0x0375); m.step(0x1a3b, 17); m.call(0x1a3b);
    m.push16(0x0378); m.step(0x1a47, 17); m.call(0x1a47);
    m.push16(0x037b); m.step(0x1439, 17); m.call(0x1439);
    regs.a = 0x00; m.step(0x037d, 7);
    mem.write8(0x2012, regs.a); m.step(0x0380, 13);
    return m.ret(10); // 0380 ret
  }

  function doF() { // 0381
    regs.a = regs.b; m.step(0x0382, 5);
    regs.cp(0xd9); m.step(0x0384, 7);
    if (regs.fZ) { m.step(0x036f, 10); return doE(); } // 0384 jz 0x036f
    m.step(0x0387, 10);
    regs.a = regs.inc8(regs.a); m.step(0x0388, 5);
    mem.write8(0x201b, regs.a); m.step(0x038b, 13);
    m.step(0x036f, 10); return doE(); // 038b jmp 0x036f
  }

  function doF2() { // 038e
    regs.a = regs.b; m.step(0x038f, 5);
    regs.cp(0x30); m.step(0x0391, 7);
    if (regs.fZ) { m.step(0x036f, 10); return doE(); } // 0391 jz 0x036f
    m.step(0x0394, 10);
    regs.a = regs.dec8(regs.a); m.step(0x0395, 5);
    mem.write8(0x201b, regs.a); m.step(0x0398, 13);
    m.step(0x036f, 10); return doE(); // 0398 jmp 0x036f
  }

  function doD() { // 0363
    m.push16(0x0366); m.step(0x17c0, 17); m.call(0x17c0);
    regs.rlca(); m.step(0x0367, 4);
    regs.rlca(); m.step(0x0368, 4);
    if (regs.fC) { m.step(0x0381, 10); return doF(); } // 0368 jc 0x0381
    m.step(0x036b, 10);
    regs.rlca(); m.step(0x036c, 4);
    if (regs.fC) { m.step(0x038e, 10); return doF2(); } // 036c jc 0x038e
    m.step(0x036f, 10); return doE(); // fall into 0x036f
  }

  function doC() { // 034a
    regs.a = mem.read8(0x201b); m.step(0x034d, 13);
    regs.b = regs.a; m.step(0x034e, 5);
    regs.a = mem.read8(0x20ef); m.step(0x0351, 13);
    regs.and(regs.a); m.step(0x0352, 4);
    if (regs.fNZ) { m.step(0x0363, 10); return doD(); } // 0352 jnz 0x0363
    m.step(0x0355, 10);
    regs.a = mem.read8(0x201d); m.step(0x0358, 13);
    regs.rrca(); m.step(0x0359, 4);
    if (regs.fC) { m.step(0x0381, 10); return doF(); } // 0359 jc 0x0381
    m.step(0x035c, 10);
    regs.rrca(); m.step(0x035d, 4);
    if (regs.fC) { m.step(0x038e, 10); return doF2(); } // 035d jc 0x038e
    m.step(0x0360, 10);
    m.step(0x036f, 10); return doE(); // 0360 jmp 0x036f
  }

  function doB() { // 0346
    m.step(0x0347, 4); // 0346 nop
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0348, 5);
    mem.write8(regs.hl, 0x01); m.step(0x034a, 10);
    return doC(); // fall into 0x034a
  }

  function doG() { // 03b0
    if (regs.fNZ) { m.step(0x034a, 10); return doC(); } // 03b0 jnz 0x034a
    m.step(0x03b3, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03b4, 5);
    regs.decMem8(mem, regs.hl); m.step(0x03b5, 10);
    if (regs.fNZ) { m.step(0x034a, 10); return doC(); } // 03b5 jnz 0x034a
    m.step(0x03b8, 10);
    m.step(0x0346, 10); return doB(); // 03b8 jmp 0x0346
  }

  function doA() { // 033b
    regs.hl = 0x2068; m.step(0x033e, 10);
    mem.write8(regs.hl, 0x01); m.step(0x0340, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0341, 5);
    regs.a = mem.read8(regs.hl); m.step(0x0342, 7);
    regs.and(regs.a); m.step(0x0343, 4);
    m.step(0x03b0, 10); return doG(); // 0343 jmp 0x03b0
  }

  function doH() { // 039b
    regs.a = regs.inc8(regs.a); m.step(0x039c, 5);
    regs.and(0x01); m.step(0x039e, 7);
    mem.write8(0x2015, regs.a); m.step(0x03a1, 13);
    regs.rlca(); m.step(0x03a2, 4);
    regs.rlca(); m.step(0x03a3, 4);
    regs.rlca(); m.step(0x03a4, 4);
    regs.rlca(); m.step(0x03a5, 4);
    regs.hl = 0x1c70; m.step(0x03a8, 10);
    regs.add(regs.l); m.step(0x03a9, 4);
    regs.l = regs.a; m.step(0x03aa, 5);
    mem.write16(0x2018, regs.hl); m.step(0x03ad, 16); // 03aa shld 0x2018
    m.step(0x036f, 10); return doE(); // 03ad jmp 0x036f
  }

  function doJ() { // 032c
    m.push16(0x032f); m.step(0x1a7f, 17); m.call(0x1a7f);
    m.step(0x0817, 10); return m.call(0x0817); // 032f jmp 0x0817
  }

  regs.hl = m.pop16(); m.step(0x028f, 10); // 028e pop h (dispatcher's record pointer)
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0290, 5);
  regs.a = mem.read8(regs.hl); m.step(0x0291, 7);
  regs.cp(0xff); m.step(0x0293, 7);
  if (regs.fZ) { m.step(0x033b, 10); return doA(); } // 0293 jz 0x033b
  m.step(0x0296, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0297, 5);
  regs.decMem8(mem, regs.hl); m.step(0x0298, 10); // 0297 dcr m (timer)
  if (regs.fNZ) { return m.ret(11); } m.step(0x0299, 5); // 0298 rnz
  regs.b = regs.a; m.step(0x029a, 5);
  regs.xor(regs.a); m.step(0x029b, 4);
  mem.write8(0x2068, regs.a); m.step(0x029e, 13);
  mem.write8(0x2069, regs.a); m.step(0x02a1, 13);
  regs.a = 0x30; m.step(0x02a3, 7);
  mem.write8(0x206a, regs.a); m.step(0x02a6, 13);
  regs.a = regs.b; m.step(0x02a7, 5);
  mem.write8(regs.hl, 0x05); m.step(0x02a9, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x02aa, 5);
  regs.decMem8(mem, regs.hl); m.step(0x02ab, 10);
  if (regs.fNZ) { m.step(0x039b, 10); return doH(); } // 02ab jnz 0x039b
  m.step(0x02ae, 10);
  regs.hl = mem.read16(0x201a); m.step(0x02b1, 16); // 02ae lhld 0x201a
  regs.b = 0x10; m.step(0x02b3, 7);
  m.push16(0x02b6); m.step(0x1424, 17); m.call(0x1424);
  regs.hl = 0x2010; m.step(0x02b9, 10);
  regs.de = 0x1b10; m.step(0x02bc, 10);
  regs.b = 0x10; m.step(0x02be, 7);
  m.push16(0x02c1); m.step(0x1a32, 17); m.call(0x1a32);
  regs.b = 0x00; m.step(0x02c3, 7);
  m.push16(0x02c6); m.step(0x19dc, 17); m.call(0x19dc);
  regs.a = mem.read8(0x206d); m.step(0x02c9, 13);
  regs.and(regs.a); m.step(0x02ca, 4);
  if (regs.fNZ) { return m.ret(11); } m.step(0x02cb, 5); // 02ca rnz
  regs.a = mem.read8(0x20ef); m.step(0x02ce, 13);
  regs.and(regs.a); m.step(0x02cf, 4);
  if (regs.fZ) { return m.ret(11); } m.step(0x02d0, 5); // 02cf rz
  regs.sp = 0x2400; m.step(0x02d3, 10);
  m.io.setInte(true); m.step(0x02d4, 4); // 02d3 ei
  m.push16(0x02d7); m.step(0x19d7, 17); m.call(0x19d7);
  m.push16(0x02da); m.step(0x092e, 17); m.call(0x092e);
  regs.and(regs.a); m.step(0x02db, 4);
  if (regs.fZ) { m.step(0x166d, 10); return m.call(0x166d); } // 02db jz 0x166d
  m.step(0x02de, 10);
  m.push16(0x02e1); m.step(0x18e7, 17); m.call(0x18e7);
  regs.a = mem.read8(regs.hl); m.step(0x02e2, 7);
  regs.and(regs.a); m.step(0x02e3, 4);
  if (regs.fZ) { m.step(0x032c, 10); return doJ(); } // 02e3 jz 0x032c
  m.step(0x02e6, 10);
  regs.a = mem.read8(0x20ce); m.step(0x02e9, 13);
  regs.and(regs.a); m.step(0x02ea, 4);
  if (regs.fZ) { m.step(0x032c, 10); return doJ(); } // 02ea jz 0x032c
  m.step(0x02ed, 10);
  return m.call(0x02ed); // 02ed fall into loc_02ed
}
