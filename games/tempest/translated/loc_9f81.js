// SPDX-License-Identifier: GPL-3.0-only
// loc_9f81 (ROM 0x9f81-0x9fc3) -- per-slot(x) segment-flag step, then tail-jmp into loc_9e5c's body at
// 0x9e5f (loc_9e5c minus its own $9eab pre-step guard). Two external dispatch entries:
//   0x9f81: jsr $9d67, jsr $9c4f, then jmp $9f99 (skip the bit6 seed).
//   0x9f8a: clear bit6 of $0283,x, seed it from bit6 of POKEY1 RANDOM ($60ca via BIT->V), store, join $9f99.
// Shared tail ($9f99, internal): if $0111 == 0 skip. Else, when bit6($0283,x) is clear and $02b9,x >= $0f,
// OR bit6 is set and $02b9,x == 0, toggle bit6 of $0283,x (eor $40). Then set $010b = $66 and jmp $9e5f.
// $60ca = POKEY1 reg $0a = RANDOM: this routine reads the RNG.
export function loc_9f81(m) {
  m.push16(0x9f83); m.step(0x9f84, 6); m.call(0x9d67);
  m.push16(0x9f86); m.step(0x9f87, 6); m.call(0x9c4f);
  m.step(0x9f99, 3); return loc_9f81_9f99(m);
}

export function loc_9f8a(m) {
  const { regs, mem } = m;
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9f8d, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0xbf); m.step(0x9f8f, 2);
  regs.bit(mem.read8(0x60ca)); m.step(0x9f92, 4);
  if (!regs.fV) { m.step(0x9f96, 3); }
  else { m.step(0x9f94, 2); regs.ora(0x40); m.step(0x9f96, 2); }
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9f99, 5);
  return loc_9f81_9f99(m);
}

// Internal join reached from loc_9f81 (jmp) and loc_9f8a (fall-through); not an external dispatch entry.
function loc_9f81_9f99(m) {
  const { regs, mem } = m;
  L_9fbc: {
    L_9fb4: {
      L_9faf: {
        regs.a = mem.read8(0x0111); regs.setNZ(regs.a); m.step(0x9f9c, 4);
        if (regs.fZ) { m.step(0x9fbc, 3); break L_9fbc; }
        m.step(0x9f9e, 2);
        { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fa1, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.and(0x40); m.step(0x9fa3, 2);
        if (!regs.fZ) { m.step(0x9faf, 3); break L_9faf; }
        m.step(0x9fa5, 2);
        { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fa8, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
        regs.cmp(0x0f); m.step(0x9faa, 2);
        if (regs.fC) { m.step(0x9fb4, 3); break L_9fb4; }
        m.step(0x9fac, 2);
        regs.clv(); m.step(0x9fad, 2);
        m.step(0x9fbc, 3); break L_9fbc;
      }
      { const b = 0x02b9, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fb2, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
      if (!regs.fZ) { m.step(0x9fbc, 3); break L_9fbc; }
      m.step(0x9fb4, 2);
    }
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9fb7, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.eor(0x40); m.step(0x9fb9, 2);
    mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9fbc, 5);
  }
  regs.a = 0x66; regs.setNZ(regs.a); m.step(0x9fbe, 2);
  mem.write8(0x010b, regs.a); m.step(0x9fc1, 4);
  m.step(0x9e5f, 3); return m.call(0x9e5f);
}

