// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_34da  (ROM 0x34DA-0x34EF) — per-call tick housekeeping for two counters.
 * Bumps the free-running tick counter at 0x8090 every call; on the once-per-256
 * wrap (0xFF -> 0x00) it vectors out to loc_34f0 (a periodic state refresh),
 * whose own `ret` returns to OUR caller. Otherwise it acts only on every 4th
 * tick: unless (tick & 3) == 0 it returns immediately (`ret nz`); on the 4th
 * tick it advances a second counter at 0x8085, holding that counter's bit 3
 * clear (`and 0xf7`), and returns.
 *
 *   34da  3a 90 80     ld   a,(0x8090)
 *   34dd  3c           inc  a
 *   34de  32 90 80     ld   (0x8090),a
 *   34e1  28 0d        jr   z,0x34f0
 *   34e3  e6 03        and  0x03
 *   34e5  c0           ret  nz
 *   34e6  3a 85 80     ld   a,(0x8085)
 *   34e9  3c           inc  a
 *   34ea  e6 f7        and  0xf7
 *   34ec  32 85 80     ld   (0x8085),a
 *   34ef  c9           ret
 *
 * The Z tested by `jr z` is `inc a`'s -- `ld (0x8090),a` writes memory and
 * touches no flags, so it survives to the branch (Z set iff the counter just
 * wrapped from 0xFF to 0x00). `jr z,0x34f0` is a jump-OUT: loc_34f0 is a
 * separate routine, so it is modelled as a tail-jump (its `ret` returns to OUR
 * caller), not a call -- no trailing m.ret on that path. `and 0x03` overwrites
 * A, but only its Z/NZ is consumed (by `ret nz`); the reduced value is
 * discarded because the 4th-tick path reloads A from 0x8085. The trailing
 * `inc a` sets flags that `and 0xf7` immediately overwrites, and nothing reads
 * the `and 0xf7` flags before the unconditional `ret`.
 */
export function loc_34da(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8090);
  m.step(0x34dd, 13); // ld a,(0x8090) -- the free-running tick counter
  regs.a = regs.inc8(regs.a);
  m.step(0x34de, 4); // inc a -- sets Z iff it just wrapped 0xFF -> 0x00
  mem.write8(0x8090, regs.a);
  m.step(0x34e1, 13); // ld (0x8090),a -- store back; leaves flags intact
  if (regs.fZ) {
    m.step(0x34f0, 12); // jr z taken -- counter wrapped, vector to the refresh
    return m.call(0x34f0); // tail-jump: loc_34f0's own ret returns to OUR caller
  }
  m.step(0x34e3, 7); // jr z not taken

  regs.and(0x03);
  m.step(0x34e5, 7); // and 0x03 -- isolate the low 2 bits of the tick counter
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- not a 4th tick, nothing to do
    return;
  }
  m.step(0x34e6, 5); // ret nz not taken -- (tick & 3) == 0, act on this tick

  regs.a = mem.read8(0x8085);
  m.step(0x34e9, 13); // ld a,(0x8085) -- the second counter
  regs.a = regs.inc8(regs.a);
  m.step(0x34ea, 4); // inc a
  regs.and(0xf7);
  m.step(0x34ec, 7); // and 0xf7 -- clear bit 3, holding it low
  mem.write8(0x8085, regs.a);
  m.step(0x34ef, 13); // ld (0x8085),a
  m.ret(); // ret
}
