// SPDX-License-Identifier: GPL-3.0-only

// loc_6f5e  (ROM 0x6f5e-0x6f9c) -- level-intro phase 3 timing gate. While the (0x8f48) delay is 0x20
// it ticks a secondary (0x8f52) sub-count (queuing sound 0x0315 each step, holding while 0x89e5 is
// set). Once (0x8f48) itself counts down to 0, and only on world 3 ((0x8907)==3), it runs a 0x79-byte
// ANTI-TAMPER compare of loc_0b32 against its 0x7071 clone (mismatch jumps to the loc_0ac8 clone at
// 0x6df9); finally it advances the phase by writing (0x8f51)=6.
export function loc_6f5e(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f48;
  m.step(0x6f61, 10); // 6f5e  ld hl,0x8f48
  regs.a = mem.read8(regs.hl);
  m.step(0x6f62, 7); // 6f61  ld a,(hl)
  regs.cp(0x20);
  m.step(0x6f64, 7); // 6f62  cp 0x20
  if (regs.fZ) {
    m.step(0x6f66, 7); // 6f64  jr nz,0x6f79 (not taken)
    regs.l = 0x52;
    m.step(0x6f68, 7); // 6f66  ld l,0x52 -> 0x8f52
    regs.a = mem.read8(regs.hl);
    m.step(0x6f69, 7); // 6f68  ld a,(hl)
    regs.and(regs.a);
    m.step(0x6f6a, 4); // 6f69  and a
    if (regs.fNZ) {
      m.step(0x6f6c, 7); // 6f6a  jr z,0x6f77 (not taken)
      regs.de = 0x0315;
      m.step(0x6f6f, 10); // 6f6c  ld de,0x0315
      m.push16(0x6f70);
      m.step(0x0038, 11); // 6f6f  rst 0x38 -- queue sound 0x0315
      m.call(0x0038);
      regs.a = mem.read8(0x89e5);
      m.step(0x6f73, 13); // 6f70  ld a,(0x89e5)
      regs.and(regs.a);
      m.step(0x6f74, 4); // 6f73  and a
      if (regs.fNZ) { m.ret(11); return; } // 6f74  ret nz
      m.step(0x6f75, 5);
      regs.decMem8(mem, regs.hl);
      m.step(0x6f76, 11); // 6f75  dec (hl) -- tick (0x8f52)
      if (regs.fNZ) { m.ret(11); return; } // 6f76  ret nz
      m.step(0x6f77, 5);
    } else {
      m.step(0x6f77, 12); // 6f6a  jr z,0x6f77
    }
    regs.l = 0x48;
    m.step(0x6f79, 7); // 6f77  ld l,0x48 -> 0x8f48
  } else {
    m.step(0x6f79, 12); // 6f64  jr nz,0x6f79
  }

  regs.decMem8(mem, regs.hl);
  m.step(0x6f7a, 11); // 6f79  dec (hl) -- tick (0x8f48)
  if (regs.fNZ) { m.ret(11); return; } // 6f7a  ret nz
  m.step(0x6f7b, 5);
  mem.write8(regs.hl, 0x60);
  m.step(0x6f7d, 10); // 6f7b  ld (hl),0x60 -- reload (0x8f48)
  regs.a = mem.read8(0x8907);
  m.step(0x6f80, 13); // 6f7d  ld a,(0x8907)
  regs.cp(0x03);
  m.step(0x6f82, 7); // 6f80  cp 0x03
  if (regs.fNZ) {
    m.step(0x6f98, 10); // 6f82  jp nz,0x6f98 -- not world 3, skip the compare
  } else {
    m.step(0x6f85, 10);
    regs.hl = 0x0b32;
    m.step(0x6f88, 10); // 6f85  ld hl,0x0b32 -- original bytes
    regs.de = 0x7071;
    m.step(0x6f8b, 10); // 6f88  ld de,0x7071 -- its clone
    regs.b = 0x79;
    m.step(0x6f8d, 7); // 6f8b  ld b,0x79
    for (;;) {
      regs.a = mem.read8(regs.de);
      m.step(0x6f8e, 7); // 6f8d  ld a,(de)
      regs.cp(mem.read8(regs.hl));
      m.step(0x6f8f, 7); // 6f8e  cp (hl)
      if (regs.fNZ) {
        m.step(0x6df9, 10); // 6f8f  jp nz,0x6df9 -- tamper: run the loc_0ac8 clone
        return m.call(0x6df9);
      }
      m.step(0x6f92, 10);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x6f93, 6); // 6f92  inc hl
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x6f94, 6); // 6f93  inc de
      if (regs.djnz() !== 0) { m.step(0x6f8d, 13); continue; } // 6f94  djnz 0x6f8d
      m.step(0x6f96, 8);
      break;
    }
    regs.h = 0x8f;
    m.step(0x6f98, 7); // 6f96  ld h,0x8f
  }
  regs.l = 0x51;
  m.step(0x6f9a, 7); // 6f98  ld l,0x51 -> 0x8f51
  mem.write8(regs.hl, 0x06);
  m.step(0x6f9c, 10); // 6f9a  ld (hl),0x06 -- advance to phase 6
  m.ret(); // 6f9c  ret
}
