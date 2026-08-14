// SPDX-License-Identifier: GPL-3.0-only

// loc_28bb  (ROM 0x28BB-0x2905) — frog-vs-diver collision test. Gated on (0x8150) bit0 and dive phase
// (0x83B7) >= 2, it bounds-checks the frog against the diver's Y ((0x8047)) and X ((0x8101)) boxes; on
// an inner-box overlap it calls the frog-kill tail 0x12D0, otherwise (jr nc,0x28ef) it stamps the
// mounted-frog tiles 0x68/0x69/0x6A/0x6B at 0xA846/0xA847/0xA866/0xA867 and sets (0x8004)=1.
export function loc_28bb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8150);
  m.step(0x28be, 13);
  regs.bit(0, regs.a);
  m.step(0x28c0, 8);
  if (regs.fZ) {
    m.ret(11); // ret z -- (0x8150) bit0 == 0
    return;
  }
  m.step(0x28c1, 5);
  regs.a = mem.read8(0x83b7);
  m.step(0x28c4, 13);
  regs.cp(0x02);
  m.step(0x28c6, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- phase < 2
    return;
  }
  m.step(0x28c7, 5);
  regs.a = mem.read8(0x8047);
  m.step(0x28ca, 13);
  regs.add(0x08);
  m.step(0x28cc, 7); // A = (0x8047) + 8
  regs.cp(0x2a);
  m.step(0x28ce, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- below 0x2a
    return;
  }
  m.step(0x28cf, 5);
  regs.cp(0x3b);
  m.step(0x28d1, 7);
  if (regs.fNC) {
    m.ret(11); // ret nc -- at/above 0x3b
    return;
  }
  m.step(0x28d2, 5);
  regs.a = mem.read8(0x8044);
  m.step(0x28d5, 13);
  regs.add(0x08);
  m.step(0x28d7, 7); // A = (0x8044) + 8
  regs.b = regs.a;
  m.step(0x28d8, 4); // B = (0x8044) + 8
  regs.a = mem.read8(0x8101);
  m.step(0x28db, 13);
  regs.c = regs.a;
  m.step(0x28dc, 4); // C = (0x8101) -- diver X
  regs.add(0x08);
  m.step(0x28de, 7); // A = (0x8101) + 8
  regs.cp(regs.b);
  m.step(0x28df, 4);
  if (regs.fC) {
    m.ret(11); // ret c -- diver right edge left of frog
    return;
  }
  m.step(0x28e0, 5);
  regs.a = regs.c;
  m.step(0x28e1, 4);
  regs.sub(0x20);
  m.step(0x28e3, 7); // A = (0x8101) - 0x20
  regs.cp(regs.b);
  m.step(0x28e4, 4);
  if (regs.fNC) {
    m.ret(11); // ret nc -- diver left of the 0x20 window
    return;
  }
  m.step(0x28e5, 5);
  regs.a = regs.c;
  m.step(0x28e6, 4);
  regs.sub(0x08);
  m.step(0x28e8, 7); // A = (0x8101) - 8
  regs.cp(regs.b);
  m.step(0x28e9, 4);
  if (regs.fNC) {
    m.step(0x28ef, 12); // jr nc,0x28ef -- outer overlap, ride
    return block_28ef();
  }
  m.step(0x28eb, 7);
  m.push16(0x28ee);
  m.step(0x12d0, 17); // call 0x12d0 -- inner overlap, frog-kill tail
  m.call(0x12d0);
  m.ret(10);

  function block_28ef() {
    regs.a = 0x01;
    m.step(0x28f1, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x28f4, 13); // (0x8004) = 1
    regs.hl = 0xa846;
    m.step(0x28f7, 10);
    mem.write8(regs.hl, 0x68);
    m.step(0x28f9, 10); // (0xa846) = 0x68
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x28fa, 6);
    mem.write8(regs.hl, 0x69);
    m.step(0x28fc, 10); // (0xa847) = 0x69
    regs.bc = 0x001f;
    m.step(0x28ff, 10);
    regs.addHl(regs.bc);
    m.step(0x2900, 11); // HL = 0xa866
    mem.write8(regs.hl, 0x6a);
    m.step(0x2902, 10); // (0xa866) = 0x6a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2903, 6);
    mem.write8(regs.hl, 0x6b);
    m.step(0x2905, 10); // (0xa867) = 0x6b
    m.ret(10);
  }
}
