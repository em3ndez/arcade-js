// SPDX-License-Identifier: GPL-3.0-only

// loc_118d  (ROM 0x118D-0x1199) -- object-slot spawn loop. Entered with B = slot count (0x06),
// IX pointing at the first 0x18-byte object record (0x8ae0), C = an activation index. For each
// of B slots it seeds E = 0x1d, calls the per-slot initializer loc_119a (which activates the
// slot if free), advances IX by 0x18 to the next record, and repeats via djnz. `ret`s to caller.
export function loc_118d(m) {
  const { regs, mem } = m;

  do {
    regs.e = 0x1d;
    m.step(0x118f, 7); // 118d  ld e,0x1d

    m.push16(0x1192);
    m.step(0x119a, 17); // 118f  call 0x119a
    m.call(0x119a, "loc_119a -- initialize/activate one object slot at IX (E=0x1d seed)");

    regs.de = 0x0018;
    m.step(0x1195, 10); // 1192  ld de,0x0018

    regs.addIx(regs.de);
    m.step(0x1197, 15); // 1195  add ix,de -- next object record

    regs.djnz();
    m.step(regs.b !== 0 ? 0x118d : 0x1199, regs.b !== 0 ? 13 : 8); // 1197  djnz 0x118d
  } while (regs.b !== 0);

  m.ret(); // 1199  ret
}
