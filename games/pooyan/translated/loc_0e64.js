// SPDX-License-Identifier: GPL-3.0-only

// loc_0e64  (ROM 0x0e64-0x0e8e) -- consume one entry from the ring at page 0x8a whose head index
// lives in (0x8a41). Empty slot (0xff) returns immediately. Otherwise, unless BOTH gate flags say
// "suppress", dispatch the entry byte through loc_0e8f; then free the slot and advance the head
// index (0x43..0x5e wrap).
export function loc_0e64(m) {
  const { regs, mem } = m;

  regs.de = 0x8a41;
  m.step(0x0e67, 10); // 0e64  ld de,0x8a41 -- head index
  regs.a = mem.read8(regs.de);
  m.step(0x0e68, 7);
  regs.l = regs.a;
  m.step(0x0e69, 4);
  regs.h = 0x8a;
  m.step(0x0e6b, 7); // 0e69  ld h,0x8a -- HL = 0x8a00+index
  regs.a = mem.read8(regs.hl);
  m.step(0x0e6c, 7);
  regs.cp(0xff);
  m.step(0x0e6e, 7);
  if (regs.fZ) { m.ret(11); return; } // 0e6e  ret z -- slot empty
  m.step(0x0e6f, 5);

  regs.b = regs.a;
  m.step(0x0e70, 4); // 0e6f  ld b,a -- keep the entry byte
  regs.a = mem.read8(0x8821);
  m.step(0x0e73, 13);
  regs.and(0x01);
  m.step(0x0e75, 7);
  let doDispatch = true;
  if (regs.fNZ) {
    m.step(0x0e7d, 12); // 0e75  jr nz,0x0e7d -- (0x8821)&1 set: dispatch
  } else {
    m.step(0x0e77, 7);
    regs.a = mem.read8(0x8806);
    m.step(0x0e7a, 13);
    regs.and(regs.a);
    m.step(0x0e7b, 4);
    if (regs.fZ) {
      m.step(0x0e81, 12); // 0e7b  jr z,0x0e81 -- both flags clear: suppress
      doDispatch = false;
    } else {
      m.step(0x0e7d, 7);
    }
  }
  if (doDispatch) {
    regs.a = regs.b;
    m.step(0x0e7e, 4);
    m.push16(0x0e81);
    m.step(0x0e8f, 17); // 0e7e  call 0x0e8f
    m.call(0x0e8f);
  }
  mem.write8(regs.hl, 0xff);
  m.step(0x0e83, 10); // 0e81  ld (hl),0xff -- free the slot
  regs.a = regs.l;
  m.step(0x0e84, 4);
  regs.cp(0x5e);
  m.step(0x0e86, 7);
  if (regs.fZ) {
    m.step(0x0e8b, 12); // 0e86  jr z,0x0e8b -- head at 0x5e: wrap to 0x43
    regs.a = 0x43;
    m.step(0x0e8d, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0e8e, 7);
    m.ret(); // 0e8e  ret
    return;
  }
  m.step(0x0e88, 7);
  regs.a = regs.inc8(regs.a);
  m.step(0x0e89, 4); // 0e88  inc a -- advance head
  mem.write8(regs.de, regs.a);
  m.step(0x0e8a, 7);
  m.ret(); // 0e8a  ret
}
