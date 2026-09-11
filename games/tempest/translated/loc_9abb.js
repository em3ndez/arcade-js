// SPDX-License-Identifier: GPL-3.0-only
// loc_9abb (ROM 0x9abb-0x9afc) -- picks a POKEY-random slot (0x60ca & 3), then walks the four
// candidate lists via $2b countdown / Y wrap, skipping empties (0x013c[x]==0) until one qualifies
// or $2b underflows (returns A=0). On success builds the $2c/$2d list pointer + $2b tag and returns
// A=$29. Second entry loc_9aee (jsr'd from 0x9b12) rebuilds $2c/$2d from the 0x9afd/0x9b02 tables
// for a caller-supplied Y. reads POKEY RANDOM (0x60ca) -> attract demo is RNG-driven; test seeds it.
export function loc_9abb(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0x9abe, 4); // POKEY RANDOM
  regs.and(0x03); m.step(0x9ac0, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9ac1, 2);            // tay
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x9ac3, 2);
  mem.write8(0x2b, regs.a); m.step(0x9ac5, 3);
  mem.write8(0x39, regs.x); m.step(0x9ac7, 3);                       // stash X
  while (true) {                                                     // loop top = 0x9ac7
    mem.write8(0x2b, regs.dec8(mem.read8(0x2b))); m.step(0x9ac9, 5);
    if (regs.fN) {                                                   // bpl not taken -> $2b underflow
      m.step(0x9acb, 2);
      regs.x = mem.read8(0x39); regs.setNZ(regs.x); m.step(0x9acd, 3);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9acf, 2);
      return m.ret(6);
    }
    m.step(0x9ad0, 3);                                               // bpl taken
    regs.y = regs.dec8(regs.y); m.step(0x9ad1, 2);
    if (regs.fN) { m.step(0x9ad3, 2); regs.y = 0x03; regs.setNZ(regs.y); m.step(0x9ad5, 2); } // Y wrap
    else { m.step(0x9ad5, 3); }
    { const base = 0x0149, e = (base + regs.y) & 0xffff;
      regs.x = mem.read8(e); regs.setNZ(regs.x);
      m.step(0x9ad8, 4 + ((base & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.cpx(0x03); m.step(0x9ada, 2);
    if (!regs.fZ) { m.step(0x9ade, 3); }                            // bne taken (X != 3)
    else { m.step(0x9adc, 2); regs.x = 0x05; regs.setNZ(regs.x); m.step(0x9ade, 2); }
    { const base = 0x013c, e = (base + regs.x) & 0xffff;
      regs.a = mem.read8(e); regs.setNZ(regs.a);
      m.step(0x9ae1, 4 + ((base & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fZ) { m.step(0x9ac7, 3); continue; }                   // beq taken -> retry next slot
    m.step(0x9ae3, 2); break;                                       // beq not taken -> qualified
  }
  regs.x = mem.read8(0x39); regs.setNZ(regs.x); m.step(0x9ae5, 3);
  { const base = 0x0149, e = (base + regs.y) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a);
    m.step(0x9ae8, 4 + ((base & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.ora(0x40); m.step(0x9aea, 2);
  regs.y = 0x02; regs.setNZ(regs.y); m.step(0x9aec, 2);
  m.step(0x9af1, 3);                                                // bne always -> skip loc_9aee load
  return tail9af1(m);
}

// loc_9aee (0x9aee, jsr'd from 0x9b12) is a separate committed routine (loc_9aee.js). loc_9abb reaches the
// shared tail at 0x9af1 (its bne @9aec skips the 0x9aee ROM-table load), so the tail lives here as a private
// helper; the two entry points converge at 0x9af1. (Tail-sharing between the two files is a §4 cleanup.)
function tail9af1(m) {
  const { regs, mem } = m;
  mem.write8(0x2c, regs.a); m.step(0x9af3, 3);
  { const base = 0x9afd, e = (base + regs.y) & 0xffff;            // list-hi table
    regs.a = mem.read8(e); regs.setNZ(regs.a);
    m.step(0x9af6, 4 + ((base & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  mem.write8(0x2b, regs.y); m.step(0x9af8, 3);
  mem.write8(0x2d, regs.a); m.step(0x9afa, 3);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9afc, 3);
  return m.ret(6);
}
