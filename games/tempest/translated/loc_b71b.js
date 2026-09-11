// SPDX-License-Identifier: GPL-3.0-only
// loc_b71b (ROM 0xb71b-0xb754) -- picks a byte from table $b755 by an index derived from $0148 (($0148+$40)>>4,
// clamped <5, else 0), stashes it in $9e/$29, then dispatches on the sign of $0283,x: bit7 clear -> ldy $02b9,x,
// A=$29, jsr $bda0; bit7 set -> jsr $b634 then ldy $29, jsr $bdcb. $9e also latches 4 (or 0 if $0148 is plus).
export function loc_b71b(m) {
  const { regs, mem } = m;
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb71d, 2);
  regs.y = mem.read8(0x0148); regs.setNZ(regs.y); m.step(0xb720, 4);
  if (regs.fN) { m.step(0xb724, 3); }                                        // bmi $b724: $0148 minus -> keep A=4
  else { m.step(0xb722, 2); regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb724, 2); }
  mem.write8(0x9e, regs.a); m.step(0xb726, 3);
  regs.a = mem.read8(0x0148); regs.setNZ(regs.a); m.step(0xb729, 4);
  regs.clc(); m.step(0xb72a, 2);
  regs.adc(0x40); m.step(0xb72c, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb72d, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb72e, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb72f, 2);
  regs.a = regs.lsr(regs.a); m.step(0xb730, 2);
  regs.cmp(0x05); m.step(0xb732, 2);
  if (regs.fNC) { m.step(0xb736, 3); }                                       // bcc $b736: index < 5 kept
  else { m.step(0xb734, 2); regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb736, 2); }
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb737, 2);                    // tay
  { const b = 0xb755, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb73a, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x29, regs.a); m.step(0xb73c, 3);
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb73f, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fN) {
    m.step(0xb74c, 3);                                                       // bmi $b74c: $0283,x bit7 set
    m.push16(0xb74e); m.step(0xb74f, 6); m.call(0xb634);
    regs.y = mem.read8(0x29); regs.setNZ(regs.y); m.step(0xb751, 3);
    m.push16(0xb753); m.step(0xb754, 6); m.call(0xbdcb);
  } else {
    m.step(0xb741, 2);
    { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xb744, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xb746, 3);
    m.push16(0xb748); m.step(0xb749, 6); m.call(0xbda0);
    regs.clv(); m.step(0xb74a, 2);
    m.step(0xb754, 3); // clv;bvc $b754 unconditional join
  }
  return m.ret(6); // b754 rts
}
