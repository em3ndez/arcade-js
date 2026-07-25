// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e4a  (ROM 0x1E4A–0x1E56) — sub_1dbd rst-28 table[2] (0x6340==2): the state-2 countdown.
 *  Reached by rst-28 jump-
 * dispatch (A==2), so `ret` returns to sub_1dbd's caller (loc_197a). Decrements
 * (0x6341) each frame; on expiry clears (0x6a30) and resets the dispatcher
 * (0x6340):=0 (a 0x40-frame timed hold, armed by state 1 loc_1dc9). FINALE-LATENT
 * (A=2 reached only after state 1 advances). `ret nz` @0x1E4E falls through ONLY on
 * expiry. `dec (hl)` is the BYTE RMW at 0x6341, not the pointer. Fields not interpreted.
 *   1e4a  ld hl,0x6341 / dec (hl) / ret nz / xor a / ld (0x6a30),a / ld (0x6340),a / ret
 */
export function loc_1e4a(m) {
  const { regs, mem } = m;
  regs.hl = 0x6341;
  m.step(0x1e4d, 10); // ld hl,0x6341
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); // dec (hl) -- the BYTE at 0x6341
  m.step(0x1e4e, 11); // dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- stay in state 2
  m.step(0x1e4f, 5); // ret nz NOT taken -- counter expired
  regs.xor(regs.a);
  m.step(0x1e50, 4); // xor a
  mem.write8(0x6a30, regs.a);
  m.step(0x1e53, 13); // ld (0x6a30),a := 0
  mem.write8(0x6340, regs.a);
  m.step(0x1e56, 13); // ld (0x6340),a := 0 -- reset dispatcher to state 0
  m.ret(10); // 0x1E56
}
