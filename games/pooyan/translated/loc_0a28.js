// SPDX-License-Identifier: GPL-3.0-only

// loc_0a28  (ROM 0x0a28-0x0a3f) -- advances a 4-phase animation counter at 0x8d40, looks its
// frame word up in table 0x26f6 (loc_0c45 -> DE), then paints the same 2x2 tile source (DE) into
// two screen slots via loc_0a40: first at 0x866a, then (DE restored by push/pop) at 0x86aa.
// loc_0c45 and loc_0a40 are plain-ret -> pattern-A. Falls through into loc_0a40 for the 2nd paint.
export function loc_0a28(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, 0x0a);
  m.step(0x0a2a, 10); // 0a28  ld (hl),0x0a  (0x8d41 = frame word hi seed)
  regs.l = regs.dec8(regs.l);
  m.step(0x0a2b, 4); // 0a2a  dec l -> HL = 0x8d40
  regs.a = mem.read8(regs.hl);
  m.step(0x0a2c, 7); // 0a2b  ld a,(hl)  (old phase counter)
  regs.incMem8(mem, regs.hl);
  m.step(0x0a2d, 11); // 0a2c  inc (hl)  (advance counter)
  regs.and(0x03);
  m.step(0x0a2f, 7); // 0a2d  and 0x03  (A = phase index 0..3)
  regs.hl = 0x26f6;
  m.step(0x0a32, 10); // 0a2f  ld hl,0x26f6  (frame-word table base)
  m.push16(0x0a35);
  m.step(0x0c45, 17); // 0a32  call 0x0c45 (pattern-A) -> DE = table[A]
  m.call(0x0c45);
  m.push16(regs.de);
  m.step(0x0a36, 11); // 0a35  push de  (save the source pointer)
  regs.hl = 0x866a;
  m.step(0x0a39, 10); // 0a36  ld hl,0x866a
  m.push16(0x0a3c);
  m.step(0x0a40, 17); // 0a39  call 0x0a40 (pattern-A) -- first 2x2 paint
  m.call(0x0a40);
  regs.de = m.pop16();
  m.step(0x0a3d, 10); // 0a3c  pop de  (restore source pointer)
  regs.hl = 0x86aa;
  m.step(0x0a40, 10); // 0a3d  ld hl,0x86aa -> falls through into loc_0a40 (2nd paint, tail)
  return m.call(0x0a40);
}
