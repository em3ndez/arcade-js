// SPDX-License-Identifier: GPL-3.0-only

// loc_5152  (ROM 0x5152-0x5184, Time Pilot)
export function loc_5152(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa800);
  m.step(0x5155, 13); // ld a,(0xa800)

  regs.a = regs.inc8(regs.a);
  m.step(0x5156, 4); // inc a -- Z only if the latch byte was 0xFF

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- latch already claimed
    return;
  }
  m.step(0x5157, 5); // ret nz not taken

  for (;;) {
    body: {
      regs.a = mem.read8(regs.de);
      m.step(0x5158, 7); // ld a,(de)

      regs.a = regs.inc8(regs.a);
      m.step(0x5159, 4); // inc a -- Z only if the slot flag was 0xFF

      if (regs.fNZ) {
        m.step(0x517a, 12); // jr nz,0x517a taken -- slot not a candidate
        break body;
      }
      m.step(0x515b, 7); // jr nz not taken

      regs.a = mem.read8(0xaa10);
      m.step(0x515e, 13); // ld a,(0xaa10)

      regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
      m.step(0x5161, 19); // sub (iy+0x00)

      regs.add(regs.l);
      m.step(0x5162, 4); // add a,l -- bias by the caller's half-width

      regs.cp(regs.h);
      m.step(0x5163, 4); // cp h -- against the caller's width

      if (regs.fNC) {
        m.step(0x517a, 12); // jr nc,0x517a taken -- outside the box
        break body;
      }
      m.step(0x5165, 7); // jr nc not taken

      regs.a = mem.read8(0xaa41);
      m.step(0x5168, 13); // ld a,(0xaa41)

      regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
      m.step(0x516b, 19); // sub (iy+0x31)

      regs.add(0x08);
      m.step(0x516d, 7); // add a,0x08 -- bias by 8

      regs.cp(0x11);
      m.step(0x516f, 7); // cp 0x11 -- window of 17

      if (regs.fNC) {
        m.step(0x517a, 12); // jr nc,0x517a taken -- outside +-8
        break body;
      }
      m.step(0x5171, 7); // jr nc not taken -- a hit

      regs.a = 0xf0;
      m.step(0x5173, 7); // ld a,0xf0

      mem.write8(0xa800, regs.a);
      m.step(0x5176, 13); // ld (0xa800),a -- claim the latch

      mem.write8(regs.de, regs.a);
      m.step(0x5177, 7); // ld (de),a -- mark the slot

      m.push16(0x517a);
      m.step(0x51de, 17); // call 0x51de
      m.call(0x51de);
    }

    regs.a = regs.e;
    m.step(0x517b, 4); // ld a,e

    regs.add(0x10);
    m.step(0x517d, 7); // add a,0x10

    regs.e = regs.a;
    m.step(0x517e, 4); // ld e,a -- D untouched; E wraps within the page

    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x5180, 10); // inc iy

    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x5182, 10); // inc iy

    if (regs.djnz() !== 0) {
      m.step(0x5157, 13); // djnz taken
      continue;
    }
    m.step(0x5184, 8); // djnz not taken
    break;
  }

  m.ret(); // 5184  ret
}
