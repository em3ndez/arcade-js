// SPDX-License-Identifier: GPL-3.0-only
// loc_b69b (ROM 0xb69b-0xb6f7) -- builds a screen position for slot x and tail-jmps the vector emitter.
// Reads coord $02df,x -> $57 and the ($02b9,x)-indexed pair $03ce/$03de -> $56/$58. If phase $02cc,x is
// negative (bit7 set), it interpolates toward the next segment ($02b9,x+1 & 0x0f) by scaling each delta
// through loc_b6fa and re-adding. Then jsr $c098 / $c765(x=$61) / $bd3e (Y->$a9), indexes the $cec8 word
// table by (($03 & 3)<<1)+0x4e into X:A, restores Y=$a9, and jmp $df59 to draw.
export function loc_b69b(m) {
  const { regs, mem } = m;
  { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb69e, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x57, regs.a); m.step(0xb6a0, 3);
  { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xb6a3, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x03ce, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6a6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x56, regs.a); m.step(0xb6a8, 3);
  { const b = 0x03de, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6ab, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x58, regs.a); m.step(0xb6ad, 3);
  { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6b0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  if (regs.fPl) {
    m.step(0xb6d5, 3); // bpl 0xb6d5 taken (phase bit7 clear) -> no interpolation
  } else {
    m.step(0xb6b2, 2);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb6b3, 2); // tya
    regs.clc(); m.step(0xb6b4, 2);
    regs.adc(0x01); m.step(0xb6b6, 2);
    regs.and(0x0f); m.step(0xb6b8, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb6b9, 2); // tay -> next segment index
    { const b = 0x03ce, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6bc, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.sec(); m.step(0xb6bd, 2);
    regs.sbc(mem.read8(0x56)); m.step(0xb6bf, 3);           // delta = next - $56
    m.push16(0xb6c1); m.step(0xb6c2, 6); m.call(0xb6fa);    // scale delta by phase fraction
    regs.clc(); m.step(0xb6c3, 2);
    regs.adc(mem.read8(0x56)); m.step(0xb6c5, 3);
    mem.write8(0x56, regs.a); m.step(0xb6c7, 3);
    { const b = 0x03de, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6ca, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.sec(); m.step(0xb6cb, 2);
    regs.sbc(mem.read8(0x58)); m.step(0xb6cd, 3);
    m.push16(0xb6cf); m.step(0xb6d0, 6); m.call(0xb6fa);
    regs.clc(); m.step(0xb6d1, 2);
    regs.adc(mem.read8(0x58)); m.step(0xb6d3, 3);
    mem.write8(0x58, regs.a); m.step(0xb6d5, 3);
  }
  m.push16(0xb6d7); m.step(0xb6d8, 6); m.call(0xc098);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xb6da, 2);
  m.push16(0xb6dc); m.step(0xb6dd, 6); m.call(0xc765);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb6df, 2);
  mem.write8(0xa9, regs.a); m.step(0xb6e1, 3);
  m.push16(0xb6e3); m.step(0xb6e4, 6); m.call(0xbd3e);
  mem.write8(0xa9, regs.y); m.step(0xb6e6, 3);               // sty $a9
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xb6e8, 3);
  regs.and(0x03); m.step(0xb6ea, 2);
  regs.a = regs.asl(regs.a); m.step(0xb6eb, 2);
  regs.clc(); m.step(0xb6ec, 2);
  regs.adc(0x4e); m.step(0xb6ee, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb6ef, 2);    // tay -> word-table index
  { const b = 0xcec9, e = (b + regs.y) & 0xffff; regs.x = mem.read8(e); regs.setNZ(regs.x); m.step(0xb6f2, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0xcec8, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb6f5, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xb6f7, 3);
  m.step(0xdf59, 3); return m.call(0xdf59); // jmp 0xdf59 tail
}
