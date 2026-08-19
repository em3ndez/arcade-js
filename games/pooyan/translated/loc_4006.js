// SPDX-License-Identifier: GPL-3.0-only

// loc_4006  (ROM 0x4006-0x403b) -- per-object animation sequencer; object block based at IX.
// (IX+0eh) is a frame-hold countdown: while non-zero, decrement and return. On expiry, walk the
// animation script at (IX+0ch/0dh): a 0xff opcode reloads the pointer from the next two bytes and
// re-reads (a jump/loop in the script); otherwise the {tile,attr,hold} triple is copied into
// (IX+10h),(IX+0fh),(IX+0eh) and the advanced pointer is stored back to (IX+0ch/0dh).
export function loc_4006(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0e) & 0xffff);
  m.step(0x4009, 19); // 4006  ld a,(ix+0eh)
  regs.and(regs.a);
  m.step(0x400a, 4); // 4009  and a
  if (regs.fNZ) {
    m.step(0x400c, 7); // 400a  jr z (not taken -- still holding)
    regs.decMem8(mem, (regs.ix + 0x0e) & 0xffff);
    m.step(0x400f, 23); // 400c  dec (ix+0eh)
    m.ret(); // 400f  ret
    return;
  }
  m.step(0x4010, 12); // 400a  jr z (hold expired -> fetch next frame)

  for (;;) {
    regs.l = mem.read8((regs.ix + 0x0c) & 0xffff);
    m.step(0x4013, 19); // 4010  ld l,(ix+0ch)
    regs.h = mem.read8((regs.ix + 0x0d) & 0xffff);
    m.step(0x4016, 19); // 4013  ld h,(ix+0dh)
    regs.a = mem.read8(regs.hl);
    m.step(0x4017, 7); // 4016  ld a,(hl)
    regs.cp(0xff);
    m.step(0x4019, 7); // 4017  cp 0ffh
    if (regs.fZ) {
      m.step(0x4030, 12); // 4019  jr z (0xff -> reload script pointer)
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x4031, 6); // 4030  inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x4032, 7); // 4031  ld a,(hl)
      mem.write8((regs.ix + 0x0c) & 0xffff, regs.a);
      m.step(0x4035, 19); // 4032  ld (ix+0ch),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x4036, 6); // 4035  inc hl
      regs.a = mem.read8(regs.hl);
      m.step(0x4037, 7); // 4036  ld a,(hl)
      mem.write8((regs.ix + 0x0d) & 0xffff, regs.a);
      m.step(0x403a, 19); // 4037  ld (ix+0dh),a
      m.step(0x4010, 12); // 403a  jr 0x4010 (re-read with new pointer)
      continue;
    }
    m.step(0x401b, 7); // 4019  jr z (not taken -- normal frame)
    mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
    m.step(0x401e, 19); // 401b  ld (ix+10h),a  (tile)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x401f, 6); // 401e  inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x4020, 7); // 401f  ld a,(hl)
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a);
    m.step(0x4023, 19); // 4020  ld (ix+0fh),a  (attr)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4024, 6); // 4023  inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x4025, 7); // 4024  ld a,(hl)
    mem.write8((regs.ix + 0x0e) & 0xffff, regs.a);
    m.step(0x4028, 19); // 4025  ld (ix+0eh),a  (hold)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4029, 6); // 4028  inc hl
    mem.write8((regs.ix + 0x0c) & 0xffff, regs.l);
    m.step(0x402c, 19); // 4029  ld (ix+0ch),l
    mem.write8((regs.ix + 0x0d) & 0xffff, regs.h);
    m.step(0x402f, 19); // 402c  ld (ix+0dh),h
    m.ret(); // 402f  ret
    return;
  }
}
