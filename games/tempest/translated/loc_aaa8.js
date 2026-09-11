// SPDX-License-Identifier: GPL-3.0-only
// loc_aaa8  (ROM 0xaaa8-0xaaf2) -- per-frame draw driver: indexes the $a8b0 table by ($09&3), calls
// loc_ab14 with it, decs $016e; conditionally calls loc_aeca (unless $0a&1 and !($03&$20), in which case
// it calls loc_ab14 with $32 first). Then two more loc_ab14 draws ($2c,$2e), clamps $06 to <=$28, calls
// loc_af77, and if $17!=0 tail-calls loc_df39 with ($aaf3/$aaf4). Read off $a8b0,x may add +1 T.
export function loc_aaa8(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xaaaa, 3);
  regs.and(0x03); m.step(0xaaac, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xaaad, 2);
  regs.a = mem.read8((0xa8b0 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xaab0, 4);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xaab1, 2);
  m.push16(0xaab3); m.step(0xaab4, 6); m.call(0xab14);
  mem.write8(0x016e, regs.dec8(mem.read8(0x016e))); m.step(0xaab7, 6);
  regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xaab9, 3);
  regs.and(0x01); m.step(0xaabb, 2);
  let doAeca = false;
  // aabb beq 0xaacb
  if (regs.fZ) {
    m.step(0xaacb, 3); doAeca = true;
  } else {
    m.step(0xaabd, 2);
    regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xaabf, 3);
    regs.and(0x20); m.step(0xaac1, 2);
    // aac1 bne 0xaacb
    if (regs.fNZ) {
      m.step(0xaacb, 3); doAeca = true;
    } else {
      m.step(0xaac3, 2);
      regs.x = 0x32; regs.setNZ(regs.x); m.step(0xaac5, 2);
      m.push16(0xaac7); m.step(0xaac8, 6); m.call(0xab14);
      regs.clv(); m.step(0xaac9, 2);
      // aac9 bvc 0xaace
      if (regs.fNV) { m.step(0xaace, 3); } else { m.step(0xaacb, 2); doAeca = true; }
    }
  }
  if (doAeca) { m.push16(0xaacd); m.step(0xaace, 6); m.call(0xaeca); }
  regs.x = 0x2c; regs.setNZ(regs.x); m.step(0xaad0, 2);
  m.push16(0xaad2); m.step(0xaad3, 6); m.call(0xab14);
  regs.x = 0x2e; regs.setNZ(regs.x); m.step(0xaad5, 2);
  m.push16(0xaad7); m.step(0xaad8, 6); m.call(0xab14);
  regs.a = mem.read8(0x06); regs.setNZ(regs.a); m.step(0xaada, 3);
  regs.cmp(0x28); m.step(0xaadc, 2);
  // aadc bcc 0xaae2
  if (regs.fNC) {
    m.step(0xaae2, 3);
  } else {
    m.step(0xaade, 2);
    regs.a = 0x28; regs.setNZ(regs.a); m.step(0xaae0, 2);
    mem.write8(0x06, regs.a); m.step(0xaae2, 3);
  }
  m.push16(0xaae4); m.step(0xaae5, 6); m.call(0xaf77);
  regs.a = mem.read8(0x17); regs.setNZ(regs.a); m.step(0xaae7, 3);
  // aae7 beq 0xaaf2
  if (regs.fZ) { m.step(0xaaf2, 3); return m.ret(6); }
  m.step(0xaae9, 2);
  regs.a = mem.read8(0xaaf4); regs.setNZ(regs.a); m.step(0xaaec, 4);
  regs.x = mem.read8(0xaaf3); regs.setNZ(regs.x); m.step(0xaaef, 4);
  m.push16(0xaaf1); m.step(0xaaf2, 6); m.call(0xdf39);
  return m.ret(6);
}
