// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_03fb  (ROM 0x03FB–0x0513) — ATTRACT / intro animation + colour-cycle driver.
 * ONE caller: loc_197a @0x19B0.
 *
 * Reads (0x6227) mode selector; drives a private frame counter (0x6390), animation-table
 * copies (call 0x004e), rst 0x38 sprite offsets (loc_0038, a CALL that returns -- NOT a
 * skip), and colour-column writes (sub_0514) into colour RAM. THREE ret exits (0x04B1 ret z,
 * 0x04B6 ret nz, 0x04BD ret). Flattened from the draft's nested-fn form to module-level
 * loc_* helpers (tree idiom); backward rejoins (0x0450, 0x04AC, 0x04E1, 0x04F9) are plain calls.
 */
export function loc_03fb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6227);
  m.step(0x03fe, 13); // ld a,(0x6227)
  regs.cp(0x02);
  m.step(0x0400, 7); // cp 0x02
  if (regs.fNZ) { m.step(0x0413, 10); return m.call(0x0413); } // jp nz,0x0413
  m.step(0x0403, 10); // jp nz NOT taken -> (6227)==2 arm

  // ---- (6227)==2 arm (COLD on tape) ----
  regs.hl = 0x6908;
  m.step(0x0406, 10); // ld hl,0x6908
  regs.a = mem.read8(0x63a3);
  m.step(0x0409, 13); // ld a,(0x63a3)
  regs.c = regs.a;
  m.step(0x040a, 4); // ld c,a
  m.push16(0x040b); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 = CALL loc_0038
  regs.a = mem.read8(0x6910);
  m.step(0x040e, 13); // ld a,(0x6910)
  regs.sub(0x3b);
  m.step(0x0410, 7); // sub 0x3b
  mem.write8(0x63b7, regs.a);
  m.step(0x0413, 13); // ld (0x63b7),a -- falls into 0x0413
  return m.call(0x0413);
}
