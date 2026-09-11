// SPDX-License-Identifier: GPL-3.0-only
// loc_a65b (ROM 0xa65b-0xa69a) -- spawn enemy into slot x. and #$00 makes the leading test dead (always
// falls through). Seeds the slot's state bytes to 0x80 ($0263,x $0283,x $02a3,x), then fills three
// velocity/coordinate pairs from RNG: $02c3,x = $60da; $0323,x = jsr $a69b (signed random step); $02e3,x =
// $60ca, $0343,x = jsr $a69b made negative-if-positive (bmi keeps a negative as-is); $0303,x = $60ca,
// $0363,x = jsr $a69b. Then jsr $ccc1 (finish/link). $60ca/$60da = POKEY1 regs (RANDOM); this reads the RNG.
export function loc_a65b(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xa65d, 3);
  regs.and(0x00); m.step(0xa65f, 2);
  if (regs.fNZ) { m.step(0xa69a, 3); return m.ret(6); } // bne (dead: A always 0) -> rts
  m.step(0xa661, 2);
  regs.a = 0x80; regs.setNZ(regs.a); m.step(0xa663, 2);
  mem.write8((0x0263 + regs.x) & 0xffff, regs.a); m.step(0xa666, 5);
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0xa669, 5);
  mem.write8((0x02a3 + regs.x) & 0xffff, regs.a); m.step(0xa66c, 5);
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xa66f, 4);
  mem.write8((0x02c3 + regs.x) & 0xffff, regs.a); m.step(0xa672, 5);
  m.push16(0xa674); m.step(0xa675, 6); m.call(0xa69b); // jsr $a69b -> A
  mem.write8((0x0323 + regs.x) & 0xffff, regs.a); m.step(0xa678, 5);
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xa67b, 4);
  mem.write8((0x02e3 + regs.x) & 0xffff, regs.a); m.step(0xa67e, 5);
  m.push16(0xa680); m.step(0xa681, 6); m.call(0xa69b); // jsr $a69b -> A
  if (regs.fN) { m.step(0xa688, 3); } // bmi taken -> already negative
  else {
    m.step(0xa683, 2);
    regs.eor(0xff); m.step(0xa685, 2);
    regs.clc(); m.step(0xa686, 2);
    regs.adc(0x01); m.step(0xa688, 2);
  }
  mem.write8((0x0343 + regs.x) & 0xffff, regs.a); m.step(0xa68b, 5);
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xa68e, 4);
  mem.write8((0x0303 + regs.x) & 0xffff, regs.a); m.step(0xa691, 5);
  m.push16(0xa693); m.step(0xa694, 6); m.call(0xa69b); // jsr $a69b -> A
  mem.write8((0x0363 + regs.x) & 0xffff, regs.a); m.step(0xa697, 5);
  m.push16(0xa699); m.step(0xa69a, 6); m.call(0xccc1); // jsr $ccc1
  return m.ret(6); // a69a rts
}
