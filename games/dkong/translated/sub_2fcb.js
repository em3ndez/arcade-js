// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2fcb  (ROM 0x2FCB–0x2FCD) — ROM head 0x2FCB-0x2FCD (rst 0x30 gate-head; sibling of sub_2207).
 *
 *   2fcb  3e 0e        ld   a,0x0e
 *   2fcd  f7           rst  0x30        ; SKIPS on coin_start -> return to caller
 *
 * Same gate mechanism as sub_2207; the body (0x2FCE: ld hl,0x62b4 / dec (hl) --
 * a down-counter update) is a non-executing frontier.
 */
export function sub_2fcb(m) {
  const { regs, mem } = m;
  regs.a = 0x0e;
  m.step(0x2fcd, 7); // ld a,0x0e
  m.push16(0x2fce); // rst 0x30 pushes the body address
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // gate SKIPPED (coin_start) -> returned to caller

  // -- body @0x2FCE: two-level countdown -> periodic task 0x0501 + 0x6386 advance --
  regs.hl = 0x62b4;
  m.step(0x2fd1, 10); // ld hl,0x62b4
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x2fd2, 11); // dec (hl) -- inner timer
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- period not elapsed
  m.step(0x2fd3, 5); // ret nz NOT taken
  regs.a = 0x03;
  m.step(0x2fd5, 7); // ld a,0x03
  mem.write8(0x62b9, regs.a);
  m.step(0x2fd8, 13); // ld (0x62b9),a
  mem.write8(0x6396, regs.a);
  m.step(0x2fdb, 13); // ld (0x6396),a
  regs.de = 0x0501;
  m.step(0x2fde, 10); // ld de,0x0501
  m.push16(0x2fe1);
  m.step(0x309f, 17); // call 0x309f -- enqueue task 0x0501 (PRESERVES HL=0x62B4)
  m.call(0x309f);
  regs.a = mem.read8(0x62b3);
  m.step(0x2fe4, 13); // ld a,(0x62b3)
  mem.write8(regs.hl, regs.a); // ld (hl),a -- (0x62B4):=(0x62B3); HL survived sub_309f
  m.step(0x2fe5, 7);
  regs.hl = 0x62b1;
  m.step(0x2fe8, 10); // ld hl,0x62b1
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x2fe9, 11); // dec (hl) -- outer period counter
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x2fea, 5); // ret nz NOT taken
  regs.a = 0x01;
  m.step(0x2fec, 7); // ld a,0x01
  mem.write8(0x6386, regs.a);
  m.step(0x2fef, 13); // ld (0x6386),a -- advance the sub_1a07 rst-28 machine
  m.ret(10); // ret (0x2FEF)
}
