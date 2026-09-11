// SPDX-License-Identifier: GPL-3.0-only
// loc_b6fa (ROM 0xb6fa-0xb71a) -- signed fixed-point scale of A by the low 3 bits of slot x's phase
// counter $02cc,x. Saves A in $29 and the 3-bit fraction in $2c, then does 3 rounds of a shift-add:
// each round LSRs the fraction (bit -> C); if set, adds $29; then asl/php/ror/plp/ror sign-extends the
// running total one place (arithmetic >>1 preserving sign). X (=$2b) is preserved; returns via rts.
export function loc_b6fa(m) {
  const { regs, mem } = m;
  mem.write8(0x29, regs.a); m.step(0xb6fc, 3);
  { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6ff, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x07); m.step(0xb701, 2);
  mem.write8(0x2c, regs.a); m.step(0xb703, 3);
  mem.write8(0x2b, regs.x); m.step(0xb705, 3);
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0xb707, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb709, 2);
  for (;;) {
    mem.write8(0x2c, regs.lsr(mem.read8(0x2c))); m.step(0xb70b, 5);
    if (regs.fNC) { m.step(0xb710, 3); }                      // bcc taken -> skip add
    else { m.step(0xb70d, 2); regs.clc(); m.step(0xb70e, 2); regs.adc(mem.read8(0x29)); m.step(0xb710, 3); }
    regs.a = regs.asl(regs.a); m.step(0xb711, 2);
    m.push8(regs.p); m.step(0xb712, 3);                       // php: save asl carry
    regs.a = regs.ror(regs.a); m.step(0xb713, 2);
    regs.p = m.pull8(); m.step(0xb714, 4);                    // plp: restore carry for second ror
    regs.a = regs.ror(regs.a); m.step(0xb715, 2);
    regs.x = regs.dec8(regs.x); m.step(0xb716, 2);
    if (regs.fPl) { m.step(0xb709, 3); } else { m.step(0xb718, 2); break; } // bpl loop / fall
  }
  regs.x = mem.read8(0x2b); regs.setNZ(regs.x); m.step(0xb71a, 3);
  return m.ret(6);
}
