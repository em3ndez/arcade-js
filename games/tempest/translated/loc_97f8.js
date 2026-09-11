// SPDX-License-Identifier: GPL-3.0-only
// loc_97f8 (ROM 0x97f8-0x98a1) -- per-frame step of the moving "spike/pulsar" object. Guards: exit unless
// $0201 is negative and $0106 is negative. If $0202 == $10 seed a sound (jsr $ccee). Advances a 16-bit
// position ($0107/$0202 += $0104/$0105) clamping $0202 to <$f0 (on overflow: sound $ccf2, park at $ff). If
// $0202 >= $50 with $0115 == 0, reset a table (jsr $a7bd). Steps a second 16-bit accumulator ($5c/$5f, carry
// bumps $5b, and a $5f-change bumps $0114), then recomputes $0104/$0105 from $9f (asl asl, clamp $30, +$20).
// Finally, when $0202 < $f0, scans $03ac,x (x=$0f..0) for a slot matching $0200 whose value < $0202 -> hit
// (jsr $cd06, $a347, clear $0115, jsr $928f). Delegates go via m.call. Multiple rts early-outs.
export function loc_97f8(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x97fb, 4);
  if (regs.fN) { m.step(0x97fd, 2); return m.ret(6); } // bpl not taken -> rts
  m.step(0x97fe, 3);
  regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0x9801, 4);
  if (!regs.fN) { m.step(0x9803, 2); return m.ret(6); } // bmi not taken -> rts
  m.step(0x9804, 3);

  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x9807, 4);
  regs.cmp(0x10); m.step(0x9809, 2);
  if (regs.fNZ) { m.step(0x980e, 3); } // bne taken -> skip sound seed
  else { m.step(0x980b, 2); m.push16(0x980d); m.step(0x980e, 6); m.call(0xccee); }

  regs.a = mem.read8(0x0107); regs.setNZ(regs.a); m.step(0x9811, 4);
  regs.clc(); m.step(0x9812, 2);
  regs.adc(mem.read8(0x0104)); m.step(0x9815, 4);
  mem.write8(0x0107, regs.a); m.step(0x9818, 4);
  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x981b, 4);
  regs.adc(mem.read8(0x0105)); m.step(0x981e, 4);
  mem.write8(0x0202, regs.a); m.step(0x9821, 4);
  if (regs.fC) { m.step(0x9825, 3); } // bcs taken -> carry already set, skip cmp
  else { m.step(0x9823, 2); regs.cmp(0xf0); m.step(0x9825, 2); }
  if (!regs.fC) { m.step(0x9833, 3); } // bcc taken -> in range
  else {
    m.step(0x9827, 2);
    regs.a = 0x0e; regs.setNZ(regs.a); m.step(0x9829, 2);
    mem.write8(0x00, regs.a); m.step(0x982b, 3);
    m.push16(0x982d); m.step(0x982e, 6); m.call(0xccf2);
    regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9830, 2);
    mem.write8(0x0202, regs.a); m.step(0x9833, 4);
  }

  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x9836, 4);
  regs.cmp(0x50); m.step(0x9838, 2);
  if (!regs.fC) { m.step(0x9842, 3); } // bcc taken -> below $50, skip reset
  else {
    m.step(0x983a, 2);
    regs.a = mem.read8(0x0115); regs.setNZ(regs.a); m.step(0x983d, 4);
    if (regs.fNZ) { m.step(0x9842, 3); } // bne taken -> $0115 already set
    else { m.step(0x983f, 2); m.push16(0x9841); m.step(0x9842, 6); m.call(0xa7bd); }
  }

  regs.a = mem.read8(0x5c); regs.setNZ(regs.a); m.step(0x9844, 3);
  regs.clc(); m.step(0x9845, 2);
  regs.adc(mem.read8(0x0104)); m.step(0x9848, 4);
  mem.write8(0x5c, regs.a); m.step(0x984a, 3);
  regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0x984c, 3);
  regs.adc(mem.read8(0x0105)); m.step(0x984f, 4);
  if (!regs.fC) { m.step(0x9853, 3); } // bcc taken -> no page bump
  else { m.step(0x9851, 2); mem.write8(0x5b, regs.inc8(mem.read8(0x5b))); m.step(0x9853, 5); }
  regs.cmp(mem.read8(0x5f)); m.step(0x9855, 3);
  if (regs.fZ) { m.step(0x985a, 3); } // beq taken -> $5f unchanged
  else { m.step(0x9857, 2); mem.write8(0x0114, regs.inc8(mem.read8(0x0114))); m.step(0x985a, 6); }
  mem.write8(0x5f, regs.a); m.step(0x985c, 3);

  regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0x985e, 3);
  regs.a = regs.asl(regs.a); m.step(0x985f, 2);
  regs.a = regs.asl(regs.a); m.step(0x9860, 2);
  regs.cmp(0x30); m.step(0x9862, 2);
  if (!regs.fC) { m.step(0x9866, 3); } // bcc taken -> under clamp
  else { m.step(0x9864, 2); regs.a = 0x30; regs.setNZ(regs.a); m.step(0x9866, 2); }
  regs.clc(); m.step(0x9867, 2);
  regs.adc(0x20); m.step(0x9869, 2);
  regs.clc(); m.step(0x986a, 2);
  regs.adc(mem.read8(0x0104)); m.step(0x986d, 4);
  mem.write8(0x0104, regs.a); m.step(0x9870, 4);
  regs.a = mem.read8(0x0105); regs.setNZ(regs.a); m.step(0x9873, 4);
  regs.adc(0x00); m.step(0x9875, 2);
  mem.write8(0x0105, regs.a); m.step(0x9878, 4);

  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0x987b, 4);
  regs.cmp(0xf0); m.step(0x987d, 2);
  if (regs.fC) { m.step(0x98a1, 3); return m.ret(6); } // bcs taken -> $0202 too high, done
  m.step(0x987f, 2);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x9881, 2);
  while (true) {
    { const b = 0x03ac, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9884, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fZ) { m.step(0x989e, 3); } // beq taken -> empty slot
    else {
      m.step(0x9886, 2);
      regs.cpx(mem.read8(0x0200)); m.step(0x9889, 4);
      if (regs.fNZ) { m.step(0x989e, 3); } // bne taken -> wrong slot
      else {
        m.step(0x988b, 2);
        regs.cmp(mem.read8(0x0202)); m.step(0x988e, 4);
        if (regs.fC) { m.step(0x989e, 3); } // bcs taken -> value >= $0202
        else {
          m.step(0x9890, 2);
          m.push16(0x9892); m.step(0x9893, 6); m.call(0xcd06);
          m.push16(0x9895); m.step(0x9896, 6); m.call(0xa347);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9898, 2);
          mem.write8(0x0115, regs.a); m.step(0x989b, 4);
          m.push16(0x989d); m.step(0x989e, 6); m.call(0x928f);
        }
      }
    }
    regs.x = regs.dec8(regs.x); m.step(0x989f, 2);
    if (regs.fN) { m.step(0x98a1, 2); break; } // bpl not taken -> x < 0
    m.step(0x9881, 3); // bpl taken -> next slot
  }
  return m.ret(6); // 98a1 rts
}
