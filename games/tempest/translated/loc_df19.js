// SPDX-License-Identifier: GPL-3.0-only
// loc_df19  (ROM 0xdf19-0xdf38) -- pick a nibble index (carry/low-nibble logic), *2 -> X, emit the word
// pair from table $31e4,x through ($74),y, then jsr loc_df5f to advance the ($74) cursor and rts.
export function loc_df19(m) {
  const { regs, mem } = m;
  let toDf1f = false;
  // df19 bcc $df1f
  if (regs.fNC) { m.step(0xdf1f, 3); toDf1f = true; }
  else {
    m.step(0xdf1b, 2);
    regs.and(0x0f); m.step(0xdf1d, 2);
    // df1d beq $df24
    if (regs.fZ) { m.step(0xdf24, 3); }
    else { m.step(0xdf1f, 2); toDf1f = true; }
  }
  if (toDf1f) {
    regs.and(0x0f); m.step(0xdf21, 2);
    regs.clc(); m.step(0xdf22, 2);
    regs.adc(0x01); m.step(0xdf24, 2);
  }
  m.push8(regs.p); m.step(0xdf25, 3);
  regs.a = regs.asl(regs.a); m.step(0xdf26, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf28, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdf29, 2);
  { const addr = (0x31e4 + regs.x) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xdf2c, 4 + ((addr & 0xff00) !== 0x3100 ? 1 : 0)); }
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf2e, 6);
  { const addr = (0x31e5 + regs.x) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xdf31, 4 + ((addr & 0xff00) !== 0x3100 ? 1 : 0)); }
  regs.y = regs.inc8(regs.y); m.step(0xdf32, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf34, 6);
  m.push16(0xdf36); m.step(0xdf37, 6); m.call(0xdf5f);
  regs.p = m.pull8(); m.step(0xdf38, 4);
  return m.ret(6);
}
