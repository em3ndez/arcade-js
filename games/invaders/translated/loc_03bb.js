// SPDX-License-Identifier: GPL-3.0-only
// loc_03bb (ROM 0x03bb-0x0475, minus the 0x0430 head spliced in) -- pchl-dispatch object handler: pop
// the record pointer, switch on its type byte (1/2/3/5) and edit the record + delegate. Forward-branch
// targets are nested fns; block T (0x0436) is shared by the spine and doR. Addrs live in each m.step.
export function loc_03bb(m) {
  const { regs, mem } = m;

  function doP() { // 03fa (type 1)
    regs.a = regs.inc8(regs.a); m.step(0x03fb, 5);
    mem.write8(regs.hl, regs.a); m.step(0x03fc, 7);
    regs.a = mem.read8(0x201b); m.step(0x03ff, 13);
    regs.add(0x08); m.step(0x0401, 7);
    mem.write8(0x202a, regs.a); m.step(0x0404, 13);
    m.push16(0x0407); m.step(0x0430, 17); m.call(0x0430);
    m.step(0x1400, 10); return m.call(0x1400); // 0407 jmp 0x1400
  }

  function doQ() { // 040a (type 2)
    m.push16(0x040d); m.step(0x0430, 17); m.call(0x0430);
    m.push16(regs.de); m.step(0x040e, 11);
    m.push16(regs.hl); m.step(0x040f, 11);
    m.push16(regs.bc); m.step(0x0410, 11);
    m.push16(0x0413); m.step(0x1452, 17); m.call(0x1452);
    regs.bc = m.pop16(); m.step(0x0414, 10);
    regs.hl = m.pop16(); m.step(0x0415, 10);
    regs.de = m.pop16(); m.step(0x0416, 10);
    regs.a = mem.read8(0x202c); m.step(0x0419, 13);
    regs.add(regs.l); m.step(0x041a, 4);
    regs.l = regs.a; m.step(0x041b, 5);
    mem.write8(0x2029, regs.a); m.step(0x041e, 13);
    m.push16(0x0421); m.step(0x1491, 17); m.call(0x1491);
    regs.a = mem.read8(0x2061); m.step(0x0424, 13);
    regs.and(regs.a); m.step(0x0425, 4);
    if (regs.fZ) { return m.ret(11); } m.step(0x0426, 5); // 0425 rz
    mem.write8(0x2002, regs.a); m.step(0x0429, 13);
    return m.ret(10); // 0429 ret
  }

  function doR() { // 042a (type != 3)
    regs.cp(0x05); m.step(0x042c, 7);
    if (regs.fZ) { return m.ret(11); } m.step(0x042d, 5); // 042c rz
    m.step(0x0436, 10); return doT(); // 042d jmp 0x0436
  }

  function doT() { // 0436 (shared: spine jz + doR)
    m.push16(0x0439); m.step(0x0430, 17); m.call(0x0430);
    m.push16(0x043c); m.step(0x1452, 17); m.call(0x1452);
    regs.hl = 0x2025; m.step(0x043f, 10);
    regs.de = 0x1b25; m.step(0x0442, 10);
    regs.b = 0x07; m.step(0x0444, 7);
    m.push16(0x0447); m.step(0x1a32, 17); m.call(0x1a32);
    regs.hl = mem.read16(0x208d); m.step(0x044a, 16); // 0447 lhld 0x208d
    regs.l = regs.inc8(regs.l); m.step(0x044b, 5);
    regs.a = regs.l; m.step(0x044c, 5);
    regs.cp(0x63); m.step(0x044e, 7);
    if (regs.fC) { m.step(0x0453, 10); return doU(); } // 044e jc 0x0453
    m.step(0x0451, 10);
    regs.l = 0x54; m.step(0x0453, 7);
    return doU(); // fall into 0x0453
  }

  function doU() { // 0453
    mem.write16(0x208d, regs.hl); m.step(0x0456, 16); // 0453 shld 0x208d
    regs.hl = mem.read16(0x208f); m.step(0x0459, 16);
    regs.l = regs.inc8(regs.l); m.step(0x045a, 5);
    mem.write16(0x208f, regs.hl); m.step(0x045d, 16);
    regs.a = mem.read8(0x2084); m.step(0x0460, 13);
    regs.and(regs.a); m.step(0x0461, 4);
    if (regs.fNZ) { return m.ret(11); } m.step(0x0462, 5); // 0461 rnz
    regs.a = mem.read8(regs.hl); m.step(0x0463, 7);
    regs.and(0x01); m.step(0x0465, 7);
    regs.bc = 0x0229; m.step(0x0468, 10);
    if (regs.fNZ) { m.step(0x046e, 10); return doV(); } // 0468 jnz 0x046e
    m.step(0x046b, 10);
    regs.bc = 0xfee0; m.step(0x046e, 10);
    return doV(); // fall into 0x046e
  }

  function doV() { // 046e
    regs.hl = 0x208a; m.step(0x0471, 10);
    mem.write8(regs.hl, regs.c); m.step(0x0472, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0473, 5);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0474, 5);
    mem.write8(regs.hl, regs.b); m.step(0x0475, 7);
    return m.ret(10); // 0475 ret
  }

  regs.de = 0x202a; m.step(0x03be, 10);
  m.push16(0x03c1); m.step(0x1a06, 17); m.call(0x1a06); // 03be call 0x1a06
  regs.hl = m.pop16(); m.step(0x03c2, 10); // 03c1 pop h (dispatcher's record pointer)
  if (regs.fNC) { return m.ret(11); } m.step(0x03c3, 5); // 03c2 rnc
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03c4, 5);
  regs.a = mem.read8(regs.hl); m.step(0x03c5, 7);
  regs.and(regs.a); m.step(0x03c6, 4);
  if (regs.fZ) { return m.ret(11); } m.step(0x03c7, 5); // 03c6 rz
  regs.cp(0x01); m.step(0x03c9, 7);
  if (regs.fZ) { m.step(0x03fa, 10); return doP(); } // 03c9 jz 0x03fa
  m.step(0x03cc, 10);
  regs.cp(0x02); m.step(0x03ce, 7);
  if (regs.fZ) { m.step(0x040a, 10); return doQ(); } // 03ce jz 0x040a
  m.step(0x03d1, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03d2, 5);
  regs.cp(0x03); m.step(0x03d4, 7);
  if (regs.fNZ) { m.step(0x042a, 10); return doR(); } // 03d4 jnz 0x042a
  m.step(0x03d7, 10);
  regs.decMem8(mem, regs.hl); m.step(0x03d8, 10);
  if (regs.fZ) { m.step(0x0436, 10); return doT(); } // 03d8 jz 0x0436
  m.step(0x03db, 10);
  regs.a = mem.read8(regs.hl); m.step(0x03dc, 7);
  regs.cp(0x0f); m.step(0x03de, 7);
  if (regs.fNZ) { return m.ret(11); } m.step(0x03df, 5); // 03de rnz
  m.push16(regs.hl); m.step(0x03e0, 11);
  m.push16(0x03e3); m.step(0x0430, 17); m.call(0x0430);
  m.push16(0x03e6); m.step(0x1452, 17); m.call(0x1452);
  regs.hl = m.pop16(); m.step(0x03e7, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03e8, 5);
  regs.incMem8(mem, regs.hl); m.step(0x03e9, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03ea, 5);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03eb, 5);
  regs.decMem8(mem, regs.hl); m.step(0x03ec, 10);
  regs.decMem8(mem, regs.hl); m.step(0x03ed, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03ee, 5);
  regs.decMem8(mem, regs.hl); m.step(0x03ef, 10);
  regs.decMem8(mem, regs.hl); m.step(0x03f0, 10);
  regs.decMem8(mem, regs.hl); m.step(0x03f1, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x03f2, 5);
  mem.write8(regs.hl, 0x08); m.step(0x03f4, 10);
  m.push16(0x03f7); m.step(0x0430, 17); m.call(0x0430);
  m.step(0x1400, 10); return m.call(0x1400); // 03f7 jmp 0x1400
}
