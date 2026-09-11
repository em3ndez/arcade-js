// SPDX-License-Identifier: GPL-3.0-only
// loc_9729 (ROM 0x9729-0x9748) -- per-frame update chain. Clears bit7 of $0123, then calls the
// state updaters $9749, $97f8, $a416, $a23f, $a18f in order. If $0201 is negative (bit7 set) it
// also calls $a504 before returning.
export function loc_9729(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0123); regs.setNZ(regs.a); m.step(0x972c, 4);
  regs.and(0x7f); m.step(0x972e, 2);
  mem.write8(0x0123, regs.a); m.step(0x9731, 4);
  m.push16(0x9733); m.step(0x9734, 6); m.call(0x9749); // jsr 0x9749 (pushes jsraddr+2)
  m.push16(0x9736); m.step(0x9737, 6); m.call(0x97f8); // jsr 0x97f8
  m.push16(0x9739); m.step(0x973a, 6); m.call(0xa416); // jsr 0xa416
  m.push16(0x973c); m.step(0x973d, 6); m.call(0xa23f); // jsr 0xa23f
  m.push16(0x973f); m.step(0x9740, 6); m.call(0xa18f); // jsr 0xa18f
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x9743, 4);
  if (regs.fPl) { m.step(0x9748, 3); } // bpl 0x9748 taken (N clear), same-page 3 -> skip $a504
  else { m.step(0x9745, 2); m.push16(0x9747); m.step(0x9748, 6); m.call(0xa504); } // jsr 0xa504
  return m.ret(6); // 9748 rts
}
