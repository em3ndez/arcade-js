// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_36fe  (ROM 0x36fe-0x3747) — one-shot initializer for an actor/state block
 * in work RAM. Seeds a primary object at 0x810a-0x8112 and a twin at
 * 0x811b-0x8123 to fixed starting values, and clears the phase flag at 0x807b.
 *
 *   36fe  3e 2e        ld   a,0x2e
 *   3700  32 0b 81     ld   (0x810b),a
 *   3703  3e 24        ld   a,0x24
 *   3705  32 0a 81     ld   (0x810a),a
 *   3708  3e 00        ld   a,0x00
 *   370a  32 0d 81     ld   (0x810d),a
 *   370d  3e 97        ld   a,0x97
 *   370f  32 0c 81     ld   (0x810c),a
 *   3712  3e 00        ld   a,0x00
 *   3714  32 0e 81     ld   (0x810e),a
 *   3717  3e 01        ld   a,0x01
 *   3719  32 0f 81     ld   (0x810f),a
 *   371c  3e 01        ld   a,0x01
 *   371e  32 12 81     ld   (0x8112),a
 *   3721  3e 00        ld   a,0x00
 *   3723  32 7b 80     ld   (0x807b),a
 *   3726  3e 2f        ld   a,0x2f
 *   3728  32 1c 81     ld   (0x811c),a
 *   372b  3e 34        ld   a,0x34
 *   372d  32 1b 81     ld   (0x811b),a
 *   3730  3e 00        ld   a,0x00
 *   3732  32 1e 81     ld   (0x811e),a
 *   3735  3e 97        ld   a,0x97
 *   3737  32 1d 81     ld   (0x811d),a
 *   373a  3e 00        ld   a,0x00
 *   373c  32 1f 81     ld   (0x811f),a
 *   373f  32 20 81     ld   (0x8120),a
 *   3742  3e 01        ld   a,0x01
 *   3744  32 23 81     ld   (0x8123),a
 *   3747  c9           ret
 *
 * Pure stores of immediates — no reads, no arithmetic, so NO flags are touched
 * (F survives unchanged) and A is left holding the last immediate loaded (0x01).
 * The A value at 0x373a (0x00) feeds BOTH 0x811f and 0x8120, which is why there
 * are 15 stores but only 14 `ld a,n` loads. All targets are in work RAM, so the
 * writes are inert on the hardware-write trace (no busOffset). The neighbour
 * loc_3748 reads these back: 0x810e/0x810f as a 16-bit step vector, 0x810a/0x810d
 * as the primary X/Y, 0x8112 as a countdown timer, 0x810b as a tile code, and
 * 0x811b-0x811e as the twin's tile/position — this routine sets their spawn state.
 */
export function loc_36fe(m) {
  const { regs, mem } = m;

  regs.a = 0x2e;
  m.step(0x3700, 7); // ld a,0x2e
  mem.write8(0x810b, regs.a);
  m.step(0x3703, 13); // ld (0x810b),a -- primary tile code
  regs.a = 0x24;
  m.step(0x3705, 7); // ld a,0x24
  mem.write8(0x810a, regs.a);
  m.step(0x3708, 13); // ld (0x810a),a -- primary X
  regs.a = 0x00;
  m.step(0x370a, 7); // ld a,0x00
  mem.write8(0x810d, regs.a);
  m.step(0x370d, 13); // ld (0x810d),a -- primary Y
  regs.a = 0x97;
  m.step(0x370f, 7); // ld a,0x97
  mem.write8(0x810c, regs.a);
  m.step(0x3712, 13); // ld (0x810c),a
  regs.a = 0x00;
  m.step(0x3714, 7); // ld a,0x00
  mem.write8(0x810e, regs.a);
  m.step(0x3717, 13); // ld (0x810e),a -- step vector low
  regs.a = 0x01;
  m.step(0x3719, 7); // ld a,0x01
  mem.write8(0x810f, regs.a);
  m.step(0x371c, 13); // ld (0x810f),a -- step vector high
  regs.a = 0x01;
  m.step(0x371e, 7); // ld a,0x01
  mem.write8(0x8112, regs.a);
  m.step(0x3721, 13); // ld (0x8112),a -- countdown timer
  regs.a = 0x00;
  m.step(0x3723, 7); // ld a,0x00
  mem.write8(0x807b, regs.a);
  m.step(0x3726, 13); // ld (0x807b),a -- phase flag cleared
  regs.a = 0x2f;
  m.step(0x3728, 7); // ld a,0x2f
  mem.write8(0x811c, regs.a);
  m.step(0x372b, 13); // ld (0x811c),a -- twin tile code
  regs.a = 0x34;
  m.step(0x372d, 7); // ld a,0x34
  mem.write8(0x811b, regs.a);
  m.step(0x3730, 13); // ld (0x811b),a -- twin X
  regs.a = 0x00;
  m.step(0x3732, 7); // ld a,0x00
  mem.write8(0x811e, regs.a);
  m.step(0x3735, 13); // ld (0x811e),a -- twin Y
  regs.a = 0x97;
  m.step(0x3737, 7); // ld a,0x97
  mem.write8(0x811d, regs.a);
  m.step(0x373a, 13); // ld (0x811d),a
  regs.a = 0x00;
  m.step(0x373c, 7); // ld a,0x00
  mem.write8(0x811f, regs.a);
  m.step(0x373f, 13); // ld (0x811f),a -- A=0x00 reused by the next store too
  mem.write8(0x8120, regs.a);
  m.step(0x3742, 13); // ld (0x8120),a -- same A (0x00), no reload
  regs.a = 0x01;
  m.step(0x3744, 7); // ld a,0x01
  mem.write8(0x8123, regs.a);
  m.step(0x3747, 13); // ld (0x8123),a
  m.ret(); // ret
}
