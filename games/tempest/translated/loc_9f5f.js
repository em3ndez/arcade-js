// SPDX-License-Identifier: GPL-3.0-only
// loc_9f5f (ROM 0x9f5f-0x9f80) -- per-slot(x) firing gate. Fires only when $02df,x bit5 is set AND POKEY2
// RANDOM $60da >= threshold $015f. Then bit6 of $0159 (BIT->V) selects: V set -> call loc_9f8a; V clear ->
// split by x parity (txa;lsr->carry = bit0) -- x even (carry clear) tail-calls loc_9f8a, x odd calls
// loc_9f81. Any gate that fails -> rts unchanged. $60da = POKEY2 reg $0a RANDOM: this reads the RNG.
export function loc_9f5f(m) {
  const { regs, mem } = m;
  L_9f80: {
    { const b = 0x02df, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9f62, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0x20); m.step(0x9f64, 2);
    if (regs.fZ) { m.step(0x9f80, 3); break L_9f80; }            // beq: bit5 clear -> no fire
    m.step(0x9f66, 2);
    regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0x9f69, 4);
    regs.cmp(mem.read8(0x015f)); m.step(0x9f6c, 4);
    if (!regs.fC) { m.step(0x9f80, 3); break L_9f80; }           // bcc: RANDOM < $015f threshold
    m.step(0x9f6e, 2);
    regs.bit(mem.read8(0x0159)); m.step(0x9f71, 4);
    if (!regs.fV) {                                              // bvc 0x9f7d -> call loc_9f8a, then rts
      m.step(0x9f7d, 3);
      m.push16(0x9f7f); m.step(0x9f80, 6); m.call(0x9f8a);
      break L_9f80;
    }
    m.step(0x9f73, 2);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0x9f74, 2);      // txa
    regs.a = regs.lsr(regs.a); m.step(0x9f75, 2);               // lsr a -> carry = x bit0
    if (!regs.fC) { m.step(0x9f8a, 3); return m.call(0x9f8a); }  // bcc: x even -> tail into loc_9f8a
    m.step(0x9f77, 2);
    m.push16(0x9f79); m.step(0x9f7a, 6); m.call(0x9f81);        // jsr loc_9f81 (x odd)
    regs.clv(); m.step(0x9f7b, 2);
    m.step(0x9f80, 3);                                           // bvc 0x9f80
  }
  return m.ret(6); // 0x9f80 rts
}
