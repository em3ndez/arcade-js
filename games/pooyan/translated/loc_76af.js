// SPDX-License-Identifier: GPL-3.0-only

// loc_76af  (ROM 0x76af-0x76d3) -- a 2-phase blink timer on (0x892a)/(0x892b).
// (0x892a) is a countdown: while non-zero it is decremented and the routine returns; on zero it is
// reloaded to 0x16 and the phase bit (0x892b) toggles (inc + &1). The phase picks one of two 2-byte
// tile pairs -- 0x76e6={0x3f,0x46} or 0x76e8={0x46,0x3f} -- and writes them to (0x8471) and
// (0x84b1) (=0x8471+0x40), i.e. a blinking pair of video-RAM tiles.
// Data 0x76d4-0x76e9 (the pair tables above, plus 0x76d4/0x76dd used as display-command pointers by
// loc_7595) is NOT code; the disasm's `jp 076d4h` sites (0x32ad/0x68df) are a dead/never-taken path
// (decoding 0x76d4 as code hits `rst 38h` in 6 bytes). loc_76ea is a separate routine, its own file.
export function loc_76af(m) {
  const { regs, mem } = m;

  regs.hl = 0x892a;
  m.step(0x76b2, 10); // 76af  ld hl,0x892a
  regs.a = mem.read8(regs.hl);
  m.step(0x76b3, 7); // 76b2  ld a,(hl)
  regs.and(regs.a);
  m.step(0x76b4, 4); // 76b3  and a -- test the countdown
  if (regs.fZ) {
    m.step(0x76b8, 12); // 76b4  jr z,0x76b8 -- expired -> reload + toggle
  } else {
    m.step(0x76b6, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x76b7, 11); // 76b6  dec (hl)
    m.ret(); // 76b7  ret
    return;
  }

  mem.write8(regs.hl, 0x16);
  m.step(0x76ba, 10); // 76b8  ld (hl),0x16 -- reload countdown
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x76bb, 6); // 76ba  inc hl -> 0x892b
  regs.incMem8(mem, regs.hl);
  m.step(0x76bc, 11); // 76bb  inc (hl) -- advance phase
  regs.a = mem.read8(regs.hl);
  m.step(0x76bd, 7); // 76bc  ld a,(hl)
  regs.and(0x01);
  m.step(0x76bf, 7); // 76bd  and 0x01 -- phase parity
  regs.de = 0x76e6;
  m.step(0x76c2, 10); // 76bf  ld de,0x76e6 -- parity-1 tile pair {0x3f,0x46}
  if (regs.fNZ) {
    m.step(0x76c7, 12); // 76c2  jr nz,0x76c7 -- parity 1 keeps 0x76e6
  } else {
    m.step(0x76c4, 7);
    regs.de = 0x76e8;
    m.step(0x76c7, 10); // 76c4  ld de,0x76e8 -- parity 0 -> pair {0x46,0x3f}
  }

  regs.hl = 0x8471;
  m.step(0x76ca, 10); // 76c7  ld hl,0x8471 -- first tile cell
  regs.bc = 0x0040;
  m.step(0x76cd, 10); // 76ca  ld bc,0x0040 -- row stride
  regs.a = mem.read8(regs.de);
  m.step(0x76ce, 7); // 76cd  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x76cf, 7); // 76ce  ld (hl),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x76d0, 6); // 76cf  inc de
  regs.addHl(regs.bc);
  m.step(0x76d1, 11); // 76d0  add hl,bc -> 0x84b1
  regs.a = mem.read8(regs.de);
  m.step(0x76d2, 7); // 76d1  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x76d3, 7); // 76d2  ld (hl),a
  m.ret(); // 76d3  ret
}
