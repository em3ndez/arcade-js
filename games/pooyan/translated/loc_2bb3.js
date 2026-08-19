// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2bb3  (ROM 0x2bb3-0x2bbe) -- spawn loop: for 0x11 records (IX stepping DE, both parked in the
// alt register set by exx across the call) try to activate a slot via loc_2be5. loc_2be5 is a
// caller-skip: once it launches into a free slot it aborts this loop (return into loc_2b9a's caller).
// Entered by fallthrough from loc_2b9a and by `jr 0x2bb3` from loc_2b59.
export function loc_2bb3(m) {
  const { regs } = m;

  regs.b = 0x11; m.step(0x2bb5, 7); // 2bb3  ld b,0x11
  for (;;) {
    regs.exx(); m.step(0x2bb6, 4); // 2bb5  exx -- park B/DE
    m.push16(0x2bb9); m.step(0x2be5, 17); // 2bb6  call 0x2be5
    if (!m.call(0x2be5)) return; // caller-skip -> abort the loop
    regs.exx(); m.step(0x2bba, 4); // 2bb9  exx -- restore B/DE
    regs.addIx(regs.de); m.step(0x2bbc, 15); // 2bba  add ix,de
    if (regs.djnz() !== 0) { m.step(0x2bb5, 13); continue; } // 2bbc  djnz 0x2bb5
    m.step(0x2bbe, 8); break;
  }
  m.ret(); // 2bbe  ret
}
