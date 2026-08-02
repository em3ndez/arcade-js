// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d03  (ROM 0x1D03–0x1D89) — PLAYER walk/climb animation stepper.
 * ONE caller: 0x1B4A jp nz. 4-frame timer (0x620F); steps player Y (0x6205) by
 * -2, cycles walk frames into the sprite-control byte (0x6207), hands off to
 * entry_1da6. TWIN loc_1cf2 shares the body loc_1d11 with delta +2 / timer 3
 * (A is LIVE-IN to loc_1d11 -- the delta). Shares the tail entry_1d8a via loc_1d76.
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_1d03(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x620f);
  m.step(0x1d06, 13); // ld a,(0x620f)
  regs.and(regs.a);
  m.step(0x1d07, 4); // and a
  if (regs.fNZ) { m.step(0x1d76, 10); return m.call(0x1d76); } // jp nz,0x1d76 (timer running)
  m.step(0x1d0a, 10); // timer expired (jp nz not taken)
  regs.a = 0x04;
  m.step(0x1d0c, 7); // ld a,0x04
  mem.write8(0x620f, regs.a);
  m.step(0x1d0f, 13); // ld (0x620f),a -- reset timer := 4
  regs.a = 0xfe; // delta = -2  (** twin loc_1cf2 sets 0x02 here **)
  m.step(0x1d11, 7); // ld a,0xfe -- falls into the shared body loc_1d11
  return m.call(0x1d11);
}
