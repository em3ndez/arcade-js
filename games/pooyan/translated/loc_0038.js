// SPDX-License-Identifier: GPL-3.0-only

// loc_0038  (ROM 0x0038-0x0052) -- rst 0x38 display-command enqueue. (0x88a0) holds a write-pointer
// low byte into a ring in page 0x88; if the target slot is free (bit 7 set) store DE there (D then
// E), advance the pointer by 2, and clamp it back up to 0xc0 whenever it drops below 0xc0.
export function loc_0038(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x0039, 11); // 0038  push hl
  regs.h = 0x88;
  m.step(0x003b, 7); // 0039  ld h,0x88
  regs.a = mem.read8(0x88a0);
  m.step(0x003e, 13); // 003b  ld a,(0x88a0)
  regs.l = regs.a;
  m.step(0x003f, 4); // 003e  ld l,a
  regs.bit(7, mem.read8(regs.hl));
  m.step(0x0041, 12); // 003f  bit 7,(hl)
  if (regs.fZ) {
    m.step(0x0051, 12); // 0041  jr z,0x0051 -- slot occupied, skip enqueue
  } else {
    m.step(0x0043, 7);
    mem.write8(regs.hl, regs.d);
    m.step(0x0044, 7); // 0043  ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x0045, 4); // 0044  inc l
    mem.write8(regs.hl, regs.e);
    m.step(0x0046, 7); // 0045  ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x0047, 4); // 0046  inc l
    regs.a = regs.l;
    m.step(0x0048, 4); // 0047  ld a,l
    regs.cp(0xc0);
    m.step(0x004a, 7); // 0048  cp 0xc0
    if (regs.fNC) {
      m.step(0x004e, 12); // 004a  jr nc,0x004e -- pointer still >= 0xc0
    } else {
      m.step(0x004c, 7);
      regs.a = 0xc0;
      m.step(0x004e, 7); // 004c  ld a,0xc0 -- wrap back to ring start
    }
    mem.write8(0x88a0, regs.a);
    m.step(0x0051, 13); // 004e  ld (0x88a0),a
  }
  regs.hl = m.pop16();
  m.step(0x0052, 10); // 0051  pop hl

  m.ret(); // 0052  ret
}
