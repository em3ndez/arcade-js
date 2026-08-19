// SPDX-License-Identifier: GPL-3.0-only

// loc_0a40  (ROM 0x0a40-0x0a51) -- split-out sub-routine of loc_0a28 (its `call 0x0a40` target and
// its fall-through tail). Copies four source bytes (DE++) into a 2x2 tile block at HL: HL[0],
// HL[+1], HL[+0x21], HL[+0x20] (via +BC=0x20 then dec l). DE ends advanced by 4. Plain ret.
export function loc_0a40(m) {
  const { regs, mem } = m;

  regs.bc = 0x0020;
  m.step(0x0a43, 10); // 0a40  ld bc,0x0020  (row stride)
  regs.a = mem.read8(regs.de);
  m.step(0x0a44, 7); // 0a43  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x0a45, 7); // 0a44  ld (hl),a  (top-left)
  regs.l = regs.inc8(regs.l);
  m.step(0x0a46, 4); // 0a45  inc l
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0a47, 6); // 0a46  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x0a48, 7); // 0a47  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x0a49, 7); // 0a48  ld (hl),a  (top-right)
  regs.addHl(regs.bc);
  m.step(0x0a4a, 11); // 0a49  add hl,bc  (down one row)
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0a4b, 6); // 0a4a  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x0a4c, 7); // 0a4b  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x0a4d, 7); // 0a4c  ld (hl),a  (bottom-right)
  regs.l = regs.dec8(regs.l);
  m.step(0x0a4e, 4); // 0a4d  dec l
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0a4f, 6); // 0a4e  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x0a50, 7); // 0a4f  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x0a51, 7); // 0a50  ld (hl),a  (bottom-left)
  m.ret(); // 0a51  ret
}
