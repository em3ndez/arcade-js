// SPDX-License-Identifier: GPL-3.0-only

// loc_08b3  (ROM 0x08b3-0x08e8) -- attract sub-state 0 (dispatch target 0x08a1[0]).
// Clears (0xa028)/(0x8819), advances sub-state 0x8e51, then runs a backward ROM checksum
// from 0x64d5 (sum -> H, carry count -> L) to the 0x96 sentinel; (0x96 - L) != 0x8f raises
// the tamper flag at 0x89fb. Ends via call 0x02b9 / 0x1d0d.
export function loc_08b3(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x08b4, 4); // 08b3  xor a
  mem.write8(0xa028, regs.a);
  m.step(0x08b7, 13);
  mem.write8(0x8819, regs.a);
  m.step(0x08ba, 13);
  m.call(0x02e3);
  m.step(0x08bd, 17); // 08ba  call 0x02e3
  regs.hl = 0x8e51;
  m.step(0x08c0, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x08c1, 11); // 08c0  inc (hl) -- advance sub-state
  regs.bc = 0x64d5;
  m.step(0x08c4, 10);
  regs.l = 0x00;
  m.step(0x08c6, 7);
  regs.h = regs.l;
  m.step(0x08c7, 4);

  for (;;) {
    // 08c7  sum -> H, carry count -> L, stop at (bc)==0x96
    regs.a = mem.read8(regs.bc);
    m.step(0x08c8, 7);
    regs.cp(0x96);
    m.step(0x08ca, 7);
    if (regs.fZ) {
      m.step(0x08d4, 12); // 08ca  jr z (sentinel reached)
      break;
    }
    m.step(0x08cc, 7);
    regs.add(regs.h);
    m.step(0x08cd, 4);
    if (regs.fC) {
      m.step(0x08cf, 7); // 08cd  jr nc not taken -> count carry
      regs.l = regs.inc8(regs.l);
      m.step(0x08d0, 4);
    } else {
      m.step(0x08d0, 12); // 08cd  jr nc (taken)
    }
    regs.h = regs.a;
    m.step(0x08d1, 4);
    regs.bc = (regs.bc - 1) & 0xffff;
    m.step(0x08d2, 6);
    m.step(0x08c7, 12);
  }

  regs.sub(regs.l);
  m.step(0x08d5, 4); // 08d4  sub l
  regs.cp(0x8f);
  m.step(0x08d7, 7);
  if (regs.fZ) {
    m.step(0x08de, 12); // 08d7  jr z (checksum ok)
  } else {
    m.step(0x08d9, 7);
    regs.a = 0x01;
    m.step(0x08db, 7);
    mem.write8(0x89fb, regs.a);
    m.step(0x08de, 13); // 08db  (0x89fb) := tamper flag
  }

  regs.xor(regs.a);
  m.step(0x08df, 4);
  mem.write8(0x8806, regs.a);
  m.step(0x08e2, 13);
  m.call(0x02b9);
  m.step(0x08e5, 17); // 08e2  call 0x02b9
  m.call(0x1d0d);
  m.step(0x08e8, 17); // 08e5  call 0x1d0d
  m.ret(); // 08e8  ret
}
