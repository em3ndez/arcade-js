// SPDX-License-Identifier: GPL-3.0-only

// loc_2970  (ROM 0x2970-0x29B8) — IX sprite-object cluster entry. (0x83B7) gates how many slots run:
// <3 skips straight to the last dispatch; >=3 sets IX from (0x83FD) and runs sub-dispatcher 0x29B9,
// then a second 0x29B9 pass whose IX/IY advance only when (0x83B7)>=6. Finally IX/IY are set for the
// 0x2B83 sub-dispatcher. IX/IY flags. The >=3-but-<6 arm is genuine overlapping code (see block_299c).
export function loc_2970(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b7);
  m.step(0x2973, 13); // ld a,(0x83b7) -- the active-slot count
  regs.cp(0x03);
  m.step(0x2975, 7);
  if (regs.fC) {
    m.step(0x29a1, 12);
    return block_29a1();
  }
  m.step(0x2977, 7);
  regs.a = mem.read8(0x83fd);
  m.step(0x297a, 13); // ld a,(0x83fd) -- selects the IX descriptor pair
  regs.a = regs.dec8(regs.a);
  m.step(0x297b, 4);
  if (regs.fNZ) {
    m.step(0x2983, 12);
    return block_2983();
  }
  m.step(0x297d, 7);
  regs.ix = 0x8440;
  m.step(0x2981, 14);
  m.step(0x2987, 12); // jr 0x2987
  return block_2987();

  function block_2983() {
    regs.ix = 0x8460;
    m.step(0x2987, 14);
    return block_2987();
  }

  function block_2987() {
    regs.iy = 0x8048;
    m.step(0x298b, 14);
    m.push16(0x298e);
    m.step(0x29b9, 17);
    m.call(0x29b9);
    regs.a = mem.read8(0x83b7);
    m.step(0x2991, 13);
    regs.cp(0x06);
    m.step(0x2993, 7);
    if (regs.fC) {
      m.step(0x299c, 12);
      return block_299c();
    }
    m.step(0x2995, 7);
    regs.de = 0x0010;
    m.step(0x2998, 10);
    regs.addIx(regs.de);
    m.step(0x299a, 15); // add ix,de -- advance IX to the 2nd slot's data
    regs.iy = 0x8050;
    m.step(0x299e, 14);
    return block_299e();
  }

  // Overlapping-code arm (ROM 0x299C-0x299D): the `jr c,0x299c` lands inside the `ld iy,0x8050` above,
  // so bytes 0x50/0x80 decode as ld d,b / add a,b, then fall into the SHARED call at 0x299e with IX/IY
  // left as the first pass set them.
  function block_299c() {
    regs.d = regs.b;
    m.step(0x299d, 4);
    regs.add(regs.b);
    m.step(0x299e, 4);
    return block_299e();
  }

  function block_299e() {
    m.push16(0x29a1);
    m.step(0x29b9, 17);
    m.call(0x29b9);
    return block_29a1();
  }

  function block_29a1() {
    regs.a = mem.read8(0x83fd);
    m.step(0x29a4, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x29a5, 4);
    if (regs.fNZ) {
      m.step(0x29ad, 12);
      return block_29ad();
    }
    m.step(0x29a7, 7);
    regs.ix = 0x8480;
    m.step(0x29ab, 14);
    m.step(0x29b1, 12); // jr 0x29b1
    return block_29b1();
  }

  function block_29ad() {
    regs.ix = 0x8490;
    m.step(0x29b1, 14);
    return block_29b1();
  }

  function block_29b1() {
    regs.iy = 0x8058;
    m.step(0x29b5, 14);
    m.push16(0x29b8);
    m.step(0x2b83, 17);
    m.call(0x2b83);
    m.ret();
  }
}
