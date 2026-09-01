// SPDX-License-Identifier: GPL-3.0-only
// loc_04b6 (ROM 0x04b6-0x050d) -- object handler reached via dispatch (`pop h` drops the
// dispatcher's return addr). Rets early unless 0x206e==0 and 0x2080==1; otherwise primes a strip
// (call 0x0550), snapshots 0x2036/0x2056, steps it (call 0x0563), clamps 0x2076 at 0x10, then
// blits (call 0x1a32), maybe flags 0x206e, and tail-jumps to loc_067e. m.step carries landings.
export function loc_04b6(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); m.step(0x04b7, 10);
  regs.a = mem.read8(0x206e); m.step(0x04ba, 13);
  regs.and(regs.a); m.step(0x04bb, 4);             // ana a
  if (regs.fNZ) { return m.ret(11); }              // rnz
  m.step(0x04bc, 5);
  regs.a = mem.read8(0x2080); m.step(0x04bf, 13);
  regs.cp(0x01); m.step(0x04c1, 7);
  if (regs.fNZ) { return m.ret(11); }              // rnz
  m.step(0x04c2, 5);
  regs.de = 0x2045; m.step(0x04c5, 10);
  regs.a = 0xed; m.step(0x04c7, 7);
  m.push16(0x04ca); m.step(0x0550, 17); m.call(0x0550);
  regs.a = mem.read8(0x2036); m.step(0x04cd, 13);
  mem.write8(0x2070, regs.a); m.step(0x04d0, 13);
  regs.a = mem.read8(0x2056); m.step(0x04d3, 13);
  mem.write8(0x2071, regs.a); m.step(0x04d6, 13);
  m.push16(0x04d9); m.step(0x0563, 17); m.call(0x0563);
  regs.a = mem.read8(0x2076); m.step(0x04dc, 13);
  regs.cp(0x10); m.step(0x04de, 7);
  if (!regs.fC) {                                   // jc 0x04e7 not taken: clamp 0x2076
    m.step(0x04e1, 10);
    regs.a = mem.read8(0x1b48); m.step(0x04e4, 13);
    mem.write8(0x2076, regs.a); m.step(0x04e7, 13);
  } else {
    m.step(0x04e7, 10);
  }
  regs.a = mem.read8(0x2078); m.step(0x04ea, 13);  // loc_04e7
  regs.and(regs.a); m.step(0x04eb, 4);             // ana a
  regs.hl = 0x2045; m.step(0x04ee, 10);
  if (regs.fNZ) {                                   // jnz 0x055b: tail-delegate
    m.step(0x055b, 10);
    return m.call(0x055b);
  }
  m.step(0x04f1, 10);
  regs.de = 0x1b40; m.step(0x04f4, 10);
  regs.hl = 0x2040; m.step(0x04f7, 10);
  regs.b = 0x10; m.step(0x04f9, 7);
  m.push16(0x04fc); m.step(0x1a32, 17); m.call(0x1a32);
  regs.a = mem.read8(0x2082); m.step(0x04ff, 13);
  regs.a = regs.dec8(regs.a); m.step(0x0500, 5);   // dcr a
  if (!regs.fNZ) {                                  // jnz 0x0508 not taken: A-1 == 0
    m.step(0x0503, 10);
    regs.a = 0x01; m.step(0x0505, 7);
    mem.write8(0x206e, regs.a); m.step(0x0508, 13);
  } else {
    m.step(0x0508, 10);
  }
  regs.hl = mem.read16(0x2076); m.step(0x050b, 16); // loc_0508: lhld 0x2076
  m.step(0x067e, 10);                               // jmp 0x067e
  return m.call(0x067e);
}
