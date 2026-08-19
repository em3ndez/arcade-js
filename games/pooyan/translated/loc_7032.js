// SPDX-License-Identifier: GPL-3.0-only

// loc_7032  (ROM 0x7032-0x7058) -- level-intro phase 5. If (0x8f47) is non-zero it ticks it via
// 0x7059 (queuing sound 0x0315). Then it counts (0x8f48) down; when that reaches 0 it advances to
// phase 6 ((0x8f51)++), else on every 16th frame (low nibble 0) it toggles (0x8f54) and queues one
// of two display commands (0x06a7 / 0x0627) chosen by the new bit0 via rst 0x38.
export function loc_7032(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f47;
  m.step(0x7035, 10); // 7032  ld hl,0x8f47
  regs.a = mem.read8(regs.hl);
  m.step(0x7036, 7); // 7035  ld a,(hl)
  regs.and(regs.a);
  m.step(0x7037, 4); // 7036  and a
  if (regs.fNZ) {
    m.push16(0x703a);
    m.step(0x7059, 17); // 7037  call nz,0x7059
    m.call(0x7059);
  } else {
    m.step(0x703a, 10); // 7037  call nz not taken
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x703b, 6); // 703a  inc hl -> 0x8f48
  regs.a = mem.read8(regs.hl);
  m.step(0x703c, 7); // 703b  ld a,(hl)
  regs.and(regs.a);
  m.step(0x703d, 4); // 703c  and a
  if (regs.fZ) {
    m.step(0x7053, 12); // 703d  jr z,0x7053 -- delay elapsed
    mem.write8(regs.hl, 0x20);
    m.step(0x7055, 10); // 7053  ld (hl),0x20
    regs.l = 0x51;
    m.step(0x7057, 7); // 7055  ld l,0x51 -> 0x8f51
    regs.incMem8(mem, regs.hl);
    m.step(0x7058, 11); // 7057  inc (hl) -- advance to phase 6
    m.ret(); // 7058  ret
    return;
  }
  m.step(0x703f, 7);
  regs.decMem8(mem, regs.hl);
  m.step(0x7040, 11); // 703f  dec (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x7041, 7); // 7040  ld a,(hl)
  regs.and(0x0f);
  m.step(0x7043, 7); // 7041  and 0x0f
  regs.and(regs.a);
  m.step(0x7044, 4); // 7043  and a
  if (regs.fNZ) { m.ret(11); return; } // 7044  ret nz -- not a 16-frame boundary
  m.step(0x7045, 5);
  regs.l = 0x54;
  m.step(0x7047, 7); // 7045  ld l,0x54 -> 0x8f54
  regs.incMem8(mem, regs.hl);
  m.step(0x7048, 11); // 7047  inc (hl)
  regs.bit(0, mem.read8(regs.hl));
  m.step(0x704a, 12); // 7048  bit 0,(hl)
  regs.de = 0x06a7;
  m.step(0x704d, 10); // 704a  ld de,0x06a7
  if (regs.fZ) {
    m.step(0x7051, 12); // 704d  jr z,0x7051
  } else {
    m.step(0x704f, 7);
    regs.e = 0x27;
    m.step(0x7051, 7); // 704f  ld e,0x27 -> DE = 0x0627
  }
  m.push16(0x7052);
  m.step(0x0038, 11); // 7051  rst 0x38 -- queue DE
  m.call(0x0038);
  m.ret(); // 7052  ret
}
