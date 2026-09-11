// SPDX-License-Identifier: GPL-3.0-only
// loc_b634 (ROM 0xb634-0xb686) -- builds a screen point ($2e,$30) for slot x. y=$02b9,x picks a base coord
// pair from $03ce/$03de,y ($56/$58); y2=$02cc,x & 0x0f offsets each by the $b68b/$b687,y2 signed deltas.
// Each add biases by 0x80, then signed-saturates: on overflow clamp to 0x7f (N set) / 0x80 (N clear),
// unbias with eor 0x80, store. Finally $0112 indexes $bcdc/$bcec into $59/$5a. Also copies $57->$2f. No JSR.
export function loc_b634(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xb636, 3);
  mem.write8(0x2f, regs.a); m.step(0xb638, 3);
  { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xb63b, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  { const b = 0x03ce, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb63e, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x56, regs.a); m.step(0xb640, 3);
  { const b = 0x03de, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb643, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x58, regs.a); m.step(0xb645, 3);
  { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb648, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x0f); m.step(0xb64a, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb64b, 2); // tay -> y2
  L_b65e: {                                               // first coord: biased add + signed clamp
    regs.a = mem.read8(0x56); regs.setNZ(regs.a); m.step(0xb64d, 3);
    regs.eor(0x80); m.step(0xb64f, 2);
    regs.clc(); m.step(0xb650, 2);
    { const b = 0xb68b, e = (b + regs.y) & 0xffff; regs.adc(mem.read8(e)); m.step(0xb653, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNV) { m.step(0xb65e, 3); break L_b65e; }     // bvc -> no overflow, keep sum
    m.step(0xb655, 2);
    if (regs.fN) {                                         // bpl not taken (N set) -> clamp 0x7f
      m.step(0xb657, 2);
      regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xb659, 2);
      regs.clv(); m.step(0xb65a, 2);
      m.step(0xb65e, 3); break L_b65e;                     // clv; bvc -> b65e
    }
    m.step(0xb65c, 3);                                     // bpl taken -> clamp 0x80
    regs.a = 0x80; regs.setNZ(regs.a); m.step(0xb65e, 2);
  }
  regs.eor(0x80); m.step(0xb660, 2);
  mem.write8(0x2e, regs.a); m.step(0xb662, 3);
  L_b675: {                                               // second coord
    regs.a = mem.read8(0x58); regs.setNZ(regs.a); m.step(0xb664, 3);
    regs.eor(0x80); m.step(0xb666, 2);
    regs.clc(); m.step(0xb667, 2);
    { const b = 0xb687, e = (b + regs.y) & 0xffff; regs.adc(mem.read8(e)); m.step(0xb66a, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNV) { m.step(0xb675, 3); break L_b675; }
    m.step(0xb66c, 2);
    if (regs.fN) {
      m.step(0xb66e, 2);
      regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xb670, 2);
      regs.clv(); m.step(0xb671, 2);
      m.step(0xb675, 3); break L_b675;
    }
    m.step(0xb673, 3);
    regs.a = 0x80; regs.setNZ(regs.a); m.step(0xb675, 2);
  }
  regs.eor(0x80); m.step(0xb677, 2);
  mem.write8(0x30, regs.a); m.step(0xb679, 3);
  regs.y = mem.read8(0x0112); regs.setNZ(regs.y); m.step(0xb67c, 4);
  { const b = 0xbcdc, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb67f, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x59, regs.a); m.step(0xb681, 3);
  { const b = 0xbcec, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb684, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x5a, regs.a); m.step(0xb686, 3);
  return m.ret(6);                                         // b686 rts
}
