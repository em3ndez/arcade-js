// SPDX-License-Identifier: GPL-3.0-only

// loc_615d  (ROM 0x615d-0x6165) -- scan loop body (entry + djnz self-loop head, fall-through from
// loc_613d with A/IX/DE/B seated). Compare A with (ix+0x14): on a match tail-jump loc_6190; else
// advance IX by DE and djnz back to 0x615d, falling to boundary 0x6166 when B hits 0.
export function loc_615d(m) {
  const { regs, mem } = m;

  regs.cp(mem.read8((regs.ix + 0x14) & 0xffff)); m.step(0x6160, 19);
  if (regs.fZ) { m.step(0x6190, 12); return m.call(0x6190); } // jr z tail -> boundary
  m.step(0x6162, 7);                          // jr z not taken
  regs.addIx(regs.de);                       m.step(0x6164, 15);
  if (regs.djnz()) {
    m.step(0x615d, 13);                        // djnz taken -- next record
    return m.call(0x615d);
  }
  m.step(0x6166, 8);                           // djnz falls out -> boundary
  return m.call(0x6166);
}
