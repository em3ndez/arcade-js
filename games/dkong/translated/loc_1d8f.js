// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d8f  (ROM 0x1D8F–0x1D94) — SOUND TRIGGER: 0x6080 = 3. (6 bytes).
 * Callers: 0x1CC7 (`call c`, entry_1ac3 loc_1cc2 -- footstep/turn sound),
 *          0x1D61 (`call z`). Both conditional; this routine is unconditional.
 * Translated for completeness; not yet wired into the live dispatcher.
 *   1d8f  3e 03     ld   a,0x03
 *   1d91  32 80 60  ld   (0x6080),a
 *   1d94  c9        ret
 */
export function loc_1d8f(m) {
  const { regs, mem } = m;
  regs.a = 0x03;
  m.step(0x1d91, 7);
  mem.write8(0x6080, regs.a); // sound latch (work RAM -- no busOffset)
  m.step(0x1d94, 13);
  m.ret(10);
}
