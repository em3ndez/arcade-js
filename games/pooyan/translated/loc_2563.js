// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2563  (ROM 0x2563-0x25a5) -- frame-gated two-tile animation. Aborts if (0x8f50) is busy. Uses
// (0x8f06) as a hold countdown: while non-zero, decrement and return; on expiry reload 0x0c and bump
// the phase (0x8f07). Then, keyed on (0x8907) bit0 and the phase parity, it picks one of four source
// blocks (0x2744/0x2748/0x274c/0x2750) and blits two 2x2 tiles with loc_3325 at 0x84xx and one row
// up (-0x60). loc_3325 is pattern A; source tables are ROM data.
export function loc_2563(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f50); m.step(0x2566, 13); // 2563  ld a,(0x8f50)
  regs.and(regs.a); m.step(0x2567, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2568, 5);
  regs.hl = 0x8f06; m.step(0x256b, 10);
  regs.a = mem.read8(regs.hl); m.step(0x256c, 7); // 256b  ld a,(hl)
  regs.and(regs.a); m.step(0x256d, 4);
  if (regs.fZ) {
    m.step(0x2571, 12); // 256d  jr z,0x2571 (hold expired)
  } else {
    m.step(0x256f, 7);
    regs.decMem8(mem, regs.hl); m.step(0x2570, 11); // 256f  dec (hl)
    m.ret();
    return;
  }
  mem.write8(regs.hl, 0x0c); m.step(0x2573, 10); // 2571  ld (hl),0x0c
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2574, 6); // 2573  inc hl -> 0x8f07
  regs.incMem8(mem, regs.hl); m.step(0x2575, 11); // 2574  inc (hl) (advance phase)
  regs.exDeHl(); m.step(0x2576, 4);
  regs.a = mem.read8(0x8907); m.step(0x2579, 13); // 2576  ld a,(0x8907)
  regs.bit(0, regs.a); m.step(0x257b, 8);
  regs.hl = 0x87bb; m.step(0x257e, 10);
  regs.a = mem.read8(regs.de); m.step(0x257f, 7); // 257e  ld a,(de) (phase byte)
  if (regs.fNZ) {
    m.step(0x258f, 12); // 257f  jr nz,0x258f ((0x8907) bit0 set)
    regs.de = 0x274c; m.step(0x2592, 10);
    regs.and(0x01); m.step(0x2594, 7);
    if (regs.fZ) {
      m.step(0x2599, 12);
    } else {
      m.step(0x2596, 7);
      regs.de = 0x2750; m.step(0x2599, 10);
    }
  } else {
    m.step(0x2581, 7);
    regs.h = 0x84; m.step(0x2583, 7); // 2581  ld h,0x84 -> 0x84bb
    regs.de = 0x2744; m.step(0x2586, 10);
    regs.and(0x01); m.step(0x2588, 7);
    if (regs.fZ) {
      m.step(0x2599, 12);
    } else {
      m.step(0x258a, 7);
      regs.de = 0x2748; m.step(0x258d, 10);
      m.step(0x2599, 12);
    }
  }
  m.push16(regs.de); m.step(0x259a, 11);
  m.push16(0x259d); m.step(0x3325, 17); m.call(0x3325); // 259a  call 0x3325 (pattern A)
  regs.de = 0xffa0; m.step(0x25a0, 10); // 259d  ld de,0xffa0 (-0x60)
  regs.addHl(regs.de); m.step(0x25a1, 11);
  regs.de = m.pop16(); m.step(0x25a2, 10);
  m.push16(0x25a5); m.step(0x3325, 17); m.call(0x3325); // 25a2  call 0x3325 (pattern A)
  m.ret();
}
