// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3945  (ROM 0x3945-0x3954) — the reload head of a period-8 down-counter at
 * 0x8112. Every entry decrements the counter and writes it back; while it stays
 * non-zero the routine tail-jumps straight into loc_3968, and on the frame it
 * underflows (dec of 1 -> 0) it first reloads the counter to 0x08 before the
 * same tail-jump. loc_3968 then acts on the counter's low bits (`and 0x03`), so
 * this block is purely the "advance + wrap the phase, then run the phase body"
 * front end.
 *
 * Every path leaves via the jump into loc_3968, which is its own translated
 * routine reached as a tail-jump (`return m.call(0x3968)`, whose own `ret`
 * returns to OUR caller). The 19-byte block at 0x3955-0x3967 the reload path
 * skips is UNREACHED dead code and is not translated.
 *
 *   3945  3a 12 81     ld   a,(0x8112)
 *   3948  3d           dec  a
 *   3949  32 12 81     ld   (0x8112),a
 *   394c  20 1a        jr   nz,0x3968
 *   394e  3e 08        ld   a,0x08
 *   3950  32 12 81     ld   (0x8112),a
 *   3953  18 13        jr   0x3968
 */
export function loc_3945(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8112);
  m.step(0x3948, 13); // ld a,(0x8112) -- load the phase counter
  regs.a = regs.dec8(regs.a);
  m.step(0x3949, 4); // dec a -- advance the phase; sets Z on underflow to 0
  mem.write8(0x8112, regs.a);
  m.step(0x394c, 13); // ld (0x8112),a -- store it back
  if (regs.fNZ) {
    m.step(0x3968, 12); // jr nz taken -- still counting down, run the phase body
    return m.call(0x3968);
  }
  m.step(0x394e, 7); // jr nz not taken -- counter underflowed, reload it

  regs.a = 0x08;
  m.step(0x3950, 7); // ld a,0x08 -- period-8 reload value
  mem.write8(0x8112, regs.a);
  m.step(0x3953, 13); // ld (0x8112),a -- store the reloaded counter
  m.step(0x3968, 12); // jr 0x3968 -- run the phase body (skips 0x3955-0x3967 dead code)
  return m.call(0x3968);
}
