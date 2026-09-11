// SPDX-License-Identifier: GPL-3.0-only
// loc_9e5c (ROM 0x9e5c-0x9eaa) -- per-slot(x) step: jsr $9eab (pre-step guard), then falls into loc_9e5f.
// loc_9e5f is a mid-entry (tail-jmp'd from loc_9f81/loc_9f99 at 0x9fc1): the same body starting at
// 0x9e5f, run WITHOUT the $9eab guard. Sets bit7 of $0283,x; segment=$0283,x&7; segment==4 (seam):
// bit6 picks dec $02b9,x + $02cc,x=$87 vs $02cc,x=$81; segment!=4: bit6 -> inc, then $02cc,x=jsr $9ed7.
export function loc_9e5c(m) {
  m.push16(0x9e5e); m.step(0x9e5f, 6); m.call(0x9eab); // jsr $9eab guard, then fall into loc_9e5f
  return loc_9e5f(m);
}

export function loc_9e5f(m) {
  const { regs, mem } = m;
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e62, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.ora(0x80); m.step(0x9e64, 2);
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9e67, 5);
  regs.and(0x07); m.step(0x9e69, 2);
  regs.cmp(0x04); m.step(0x9e6b, 2);
  if (regs.fNZ) {                                      // bne $9e8c -> segment != 4
    m.step(0x9e8c, 3);
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e8f, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0x40); m.step(0x9e91, 2);
    if (regs.fNZ) {                                    // beq not taken -> bit6 set: increment
      m.step(0x9e93, 2);
      { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e96, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      regs.clc(); m.step(0x9e97, 2);
      regs.adc(0x01); m.step(0x9e99, 2);
      regs.and(0x0f); m.step(0x9e9b, 2);
      mem.write8((0x02b9 + regs.x) & 0xffff, regs.a); m.step(0x9e9e, 5);
    } else {
      m.step(0x9e9e, 3);                               // beq $9e9e -> skip increment
    }
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ea1, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0x9ea4, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    m.push16(0x9ea6); m.step(0x9ea7, 6); m.call(0x9ed7); // jsr $9ed7
    mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9eaa, 5);
    return m.ret(6);
  }
  m.step(0x9e6d, 2);                                   // bne not taken -> segment == 4
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e70, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x40); m.step(0x9e72, 2);
  if (regs.fNZ) {                                      // bne $9e79 -> bit6 set: decrement
    m.step(0x9e79, 3);
    { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9e7c, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.sec(); m.step(0x9e7d, 2);
    regs.sbc(0x01); m.step(0x9e7f, 2);
    regs.and(0x0f); m.step(0x9e81, 2);
    mem.write8((0x02b9 + regs.x) & 0xffff, regs.a); m.step(0x9e84, 5);
    regs.a = 0x87; regs.setNZ(regs.a); m.step(0x9e86, 2);
  } else {
    m.step(0x9e74, 2);
    regs.a = 0x81; regs.setNZ(regs.a); m.step(0x9e76, 2);
    regs.clv(); m.step(0x9e77, 2);
    m.step(0x9e86, 3);                                 // bvc $9e86
  }
  mem.write8((0x02cc + regs.x) & 0xffff, regs.a); m.step(0x9e89, 5);
  regs.clv(); m.step(0x9e8a, 2);
  m.step(0x9eaa, 3);                                   // bvc $9eaa -> rts
  return m.ret(6);
}
