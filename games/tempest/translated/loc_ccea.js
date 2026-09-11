// SPDX-License-Identifier: GPL-3.0-only
// loc_ccea  (ROM 0xccea-0xccf5) -- trampoline entry: loads sound id A=0x2f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. The bytes 0xccee/0xccf2 are two further trampoline entry points (A=0x6f/
//   0x7f -> loc_ccc3); their fall-through paths from here are dead (A!=0) but modelled in range.
export function loc_ccea(m) {
  const { regs } = m;
  regs.a = 0x2f; regs.setNZ(regs.a); m.step(0xccec, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccee, 2);
  regs.a = 0x6f; regs.setNZ(regs.a); m.step(0xccf0, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccf2, 2);
  regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xccf4, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccf6, 2); return m.call(0xccf6);
}
