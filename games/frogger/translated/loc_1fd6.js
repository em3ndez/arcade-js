// SPDX-License-Identifier: GPL-3.0-only
// loc_1fd6  (ROM 0x1FD6-0x2004) — progress scoring. Range-check the frog column (0x8047) to
// [0x30,0xd0]; on a new furthest column (smaller than 0x8269) update 0x8269 and award via loc_08e0.
export function loc_1fd6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8047);
  m.step(0x1fd9, 13); // -- frog column
  regs.cp(0x30);
  m.step(0x1fdb, 7);
  if (regs.fC) { m.ret(11); return; } // ret c -- below 0x30
  m.step(0x1fdc, 5);
  regs.cp(0xd0);
  m.step(0x1fde, 7);
  regs.c = regs.a;
  m.step(0x1fdf, 4);
  if (regs.fZ) {
    m.step(0x1ff8, 12);
    return block_1ff8();
  }
  m.step(0x1fe1, 7);
  if (regs.fNC) { m.ret(11); return; } // ret nc -- above 0xd0
  m.step(0x1fe2, 5);
  return block_1fe2();

  function block_1fe2() {
    regs.a = mem.read8(0x8269);
    m.step(0x1fe5, 13); // -- furthest column so far
    regs.cp(regs.c);
    m.step(0x1fe6, 4);
    if (regs.fC) { m.ret(11); return; } // ret c -- not a new record
    m.step(0x1fe7, 5);
    if (regs.fZ) { m.ret(11); return; } // ret z -- same column
    m.step(0x1fe8, 5);
    regs.a = regs.c;
    m.step(0x1fe9, 4);
    mem.write8(0x8269, regs.a);
    m.step(0x1fec, 13); // -- new furthest column
    regs.de = 0x0001;
    m.step(0x1fef, 10); // -- DE = the point delta
    regs.cp(0x80);
    m.step(0x1ff1, 7);
    if (regs.fZ) { m.ret(11); return; } // ret z -- midpoint 0x80 awards nothing
    m.step(0x1ff2, 5);
    m.push16(regs.hl);
    m.step(0x1ff3, 11);
    m.push16(0x1ff6);
    m.step(0x08e0, 17);
    m.call(0x08e0); // -- award points
    regs.hl = m.pop16();
    m.step(0x1ff7, 10);
    m.ret();
  }

  function block_1ff8() {
    regs.a = mem.read8(0x8269);
    m.step(0x1ffb, 13); // -- furthest column so far
    regs.and(regs.a);
    m.step(0x1ffc, 4);
    if (regs.fNZ) {
      m.step(0x1fe2, 12);
      return block_1fe2();
    }
    m.step(0x1ffe, 7);
    regs.a = 0xe0;
    m.step(0x2000, 7); // -- seed above range so the 0xd0 crossing scores
    mem.write8(0x8269, regs.a);
    m.step(0x2003, 13);
    m.step(0x1fe2, 12);
    return block_1fe2();
  }
}
