// SPDX-License-Identifier: GPL-3.0-only

// loc_57c3  (ROM 0x57c3-0x57c5) -- 2-instr state-machine head. `dec b` distinguishes the
// b==1 entry (tail jp to loc_5835, the "spawn next" branch) from every other entry (b becomes
// non-zero -> fall through into loc_57c6, the animation-advance branch). Both exits are tail
// transfers reusing the caller's frame -- no push16.
export function loc_57c3(m) {
  const { regs } = m;

  regs.b = regs.dec8(regs.b);  m.step(0x57c4, 4);
  if (regs.fZ) {
    m.step(0x5835, 12);            // jr z,0x5835 taken -- tail jp
    return m.call(0x5835);
  }
  m.step(0x57c6, 7);              // jr z not taken -- fall through into loc_57c6 (tail)
  return m.call(0x57c6);
}
