// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3458  (ROM 0x3458-0x3475) — periodic countdown with an every-4th-tick
 * bit-7 toggle. Decrements the counter at 0x808b once per call; the frame it
 * underflows to zero it tail-jumps to 0x0278 (a mode/state transition, reached
 * as a jump-out so its own `ret` returns to OUR caller). While the counter is
 * still running it only acts every 4th tick: unless (counter-1) & 3 == 0 it
 * returns immediately (`ret nz`); on the 4th tick it flips bit 7 of the flag at
 * 0x8084 and bit 7 of the flag at 0x8069 (a paired orientation/animation toggle)
 * and returns.
 *
 *   3458  3a 8b 80     ld   a,(0x808b)
 *   345b  3d           dec  a
 *   345c  32 8b 80     ld   (0x808b),a
 *   345f  ca 78 02     jp   z,0x0278
 *   3462  e6 03        and  0x03
 *   3464  c0           ret  nz
 *   3465  3a 84 80     ld   a,(0x8084)
 *   3468  ee 80        xor  0x80
 *   346a  32 84 80     ld   (0x8084),a
 *   346d  3a 69 80     ld   a,(0x8069)
 *   3470  ee 80        xor  0x80
 *   3472  32 69 80     ld   (0x8069),a
 *   3475  c9           ret
 *
 * The Z tested by `jp z` is `dec a`'s -- `ld (0x808b),a` writes memory and
 * touches no flags, so it survives. `and 0x03` overwrites A but only its Z/NZ
 * is consumed (by `ret nz`); the reduced value is discarded because the toggle
 * path reloads A from 0x8084. `xor 0x80` flips bit 7 and clears carry (unread).
 */
export function loc_3458(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x808b);
  m.step(0x345b, 13); // ld a,(0x808b) -- the tick counter
  regs.a = regs.dec8(regs.a);
  m.step(0x345c, 4); // dec a -- sets Z iff it just hit zero
  mem.write8(0x808b, regs.a);
  m.step(0x345f, 13); // ld (0x808b),a -- store back; leaves flags intact
  if (regs.fZ) {
    m.step(0x0278, 10); // jp z taken -- counter expired, vector out
    return m.call(0x0278);
  }
  m.step(0x3462, 10); // jp z not taken

  regs.and(0x03);
  m.step(0x3464, 7); // and 0x03 -- isolate the low 2 bits of (counter-1)
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- not a 4th tick, nothing to toggle
    return;
  }
  m.step(0x3465, 5); // ret nz not taken -- (counter-1) is a multiple of 4

  regs.a = mem.read8(0x8084);
  m.step(0x3468, 13); // ld a,(0x8084)
  regs.xor(0x80);
  m.step(0x346a, 7); // xor 0x80 -- flip bit 7
  mem.write8(0x8084, regs.a);
  m.step(0x346d, 13); // ld (0x8084),a
  regs.a = mem.read8(0x8069);
  m.step(0x3470, 13); // ld a,(0x8069)
  regs.xor(0x80);
  m.step(0x3472, 7); // xor 0x80 -- flip bit 7 of the paired flag
  mem.write8(0x8069, regs.a);
  m.step(0x3475, 13); // ld (0x8069),a
  m.ret(); // ret
}
