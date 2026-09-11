// SPDX-License-Identifier: GPL-3.0-only
// loc_9cb6 (ROM 0x9cb6-0x9d04) -- per-slot(x) steering step keyed on flag byte $028a,x bit7.
// bit7 clear: pick Y=1, or Y=0 when coord $02df,x >= threshold $0157, then jsr $9c63.
// bit7 set: jsr $9c99, and when ($03ab? read : $ff) < $0157 flip bit7 of $028a,x (eor #$80).
// Common tail at $9ce4: if $0148 bit7 clear AND $02df,x < $0157 AND $0200==$02b9,x AND
// $0201==$02cc,x, jsr $a347 (loc_a343 body). Every exit rts. Calls $9c63/$9c99 are EXPORTED.
export function loc_9cb6(m) {
  const { regs, mem } = m;
  L_9d04: {
    L_9ce4: {
      regs.y = 0x01; regs.setNZ(regs.y); m.step(0x9cb8, 2);          // ldy #1
      { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9cbb, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      if (regs.fN) {
        // bmi 9ccd taken -> bit7 set path
        m.step(0x9ccd, 3);
        m.push16(0x9ccf); m.step(0x9cd0, 6); m.call(0x9c99);         // jsr 0x9c99 (ret = 0x9ccd+2)
        regs.y = mem.read8(0x03ab); regs.setNZ(regs.y); m.step(0x9cd3, 4);
        if (regs.fNZ) { m.step(0x9cd7, 3); }                          // bne 9cd7 taken ($03ab != 0)
        else { m.step(0x9cd5, 2); regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9cd7, 2); } // lda #ff
        regs.cmp(mem.read8(0x0157)); m.step(0x9cda, 4);
        if (regs.fNC) { m.step(0x9ce4, 3); break L_9ce4; }            // bcc 9ce4 taken
        m.step(0x9cdc, 2);
        { const b = 0x028a, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9cdf, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.eor(0x80); m.step(0x9ce1, 2);
        mem.write8((0x028a + regs.x) & 0xffff, regs.a); m.step(0x9ce4, 5); // sta 028a,x -> fall L_9ce4
      } else {
        // bmi not taken -> bit7 clear path
        m.step(0x9cbd, 2);
        { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9cc0, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.cmp(mem.read8(0x0157)); m.step(0x9cc3, 4);
        if (regs.fNC) { m.step(0x9cc7, 3); }                          // bcc 9cc7 taken (skip ldy #0)
        else { m.step(0x9cc5, 2); regs.y = 0x00; regs.setNZ(regs.y); m.step(0x9cc7, 2); } // ldy #0
        m.push16(0x9cc9); m.step(0x9cca, 6); m.call(0x9c63);          // jsr 0x9c63 (ret = 0x9cc7+2)
        regs.clv(); m.step(0x9ccb, 2);
        m.step(0x9ce4, 3); break L_9ce4;                             // bvc 9ce4 (clv;bvc = uncond join)
      }
    }
    // L_9ce4: common tail
    regs.a = mem.read8(0x0148); regs.setNZ(regs.a); m.step(0x9ce7, 4);
    if (regs.fN) { m.step(0x9d04, 4); break L_9d04; }                 // bmi 9d04 (page cross)
    m.step(0x9ce9, 2);
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9cec, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cmp(mem.read8(0x0157)); m.step(0x9cef, 4);
    if (regs.fC) { m.step(0x9d04, 4); break L_9d04; }                 // bcs 9d04 (page cross)
    m.step(0x9cf1, 2);
    regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0x9cf4, 4);
    { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.cmp(mem.read8(e)); m.step(0x9cf7, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNZ) { m.step(0x9d04, 4); break L_9d04; }                // bne 9d04 (page cross)
    m.step(0x9cf9, 2);
    regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x9cfc, 4);
    { const b = 0x02cc, e = (b + regs.x) & 0xffff; regs.cmp(mem.read8(e)); m.step(0x9cff, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNZ) { m.step(0x9d04, 3); break L_9d04; }                // bne 9d04 (same page)
    m.step(0x9d01, 2);
    m.push16(0x9d03); m.step(0x9d04, 6); m.call(0xa347);             // jsr 0xa347 (ret = 0x9d01+2) -> fall rts
  }
  return m.ret(6); // 9d04 rts
}
