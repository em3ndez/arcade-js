// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_26fa  (ROM 0x26FA–0x26FC) — ROM head 0x26FA-0x26FC (rst 0x30 gate-head; sibling of sub_2207).
 *
 *   26fa  3e 04        ld   a,0x04
 *   26fc  f7           rst  0x30        ; SKIPS on coin_start -> return to caller
 *
 * Reached via `call 0x26FA` @0x19A7 (197a cascade). Same gate mechanism as sub_2207;
 * differs in the A value (0x04) and the body it gates (0x26FD): a tile/position
 * dispatch on (0x6205)/(0x6229)/(0x601a) that TAIL-JUMPS to loc_277f (edge reset),
 * sub_271e (call 0x2745 wrapper) or sub_2722 (animate+spawn), else `ret`. The gate
 * skips on coin_start/attract -> the body is unreached there; it runs on
 * the 0x197A gameplay cascade. WIRES sub_271e + sub_2722 (WIRING-SITES sites 8/9):
 * the ROM's 0x2713/0x2716/0x271B are jp z/jp c (tail jumps), not calls as the note
 * read -- reaching those routines by falling through / conditional jump.
 */
export function sub_26fa(m) {
  const { regs, mem } = m;
  regs.a = 0x04;
  m.step(0x26fc, 7); // ld a,0x04
  m.push16(0x26fd); // rst 0x30 pushes the body address
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // gate SKIPPED (coin_start) -> returned to caller

  // -- body @0x26FD: tile/position dispatch --
  regs.a = mem.read8(0x6205);
  m.step(0x2700, 13); // ld a,(0x6205)
  regs.cp(0xf0);
  m.step(0x2702, 7); // cp 0xf0
  if (regs.fNC) { m.step(0x277f, 10); return m.call(0x277f); } // jp nc,0x277f -- edge reset
  m.step(0x2705, 10); // jp nc NOT taken
  regs.a = mem.read8(0x6229);
  m.step(0x2708, 13); // ld a,(0x6229)
  regs.a = regs.dec8(regs.a);
  m.step(0x2709, 4); // dec a -- flags feed the 0x270C jp nz
  regs.a = mem.read8(0x601a);
  m.step(0x270c, 13); // ld a,(0x601a) -- reload A (ld preserves dec's flags)
  if (regs.fNZ) {
    m.step(0x271a, 10); // jp nz,0x271a -- (0x6229) != 1
    regs.rrca();
    m.step(0x271b, 4); // rrca (loc_271a)
    if (regs.fC) { m.step(0x2722, 10); return m.call(0x2722); } // jp c,0x2722 -- animate+spawn
    m.step(0x271e, 10); // jp c NOT taken -> fall into 0x271e
    return m.call(0x271e); // 0x271E: call 0x2745; ret
  }
  m.step(0x270f, 10); // jp nz NOT taken -- (0x6229) == 1
  regs.and(0x03);
  m.step(0x2711, 7); // and 0x03
  regs.cp(0x01);
  m.step(0x2713, 7); // cp 0x01
  if (regs.fZ) { m.step(0x271e, 10); return m.call(0x271e); } // jp z,0x271e
  m.step(0x2716, 10); // jp z NOT taken
  if (regs.fC) { m.step(0x2722, 10); return m.call(0x2722); } // jp c,0x2722
  m.step(0x2719, 10); // jp c NOT taken -> fall into 0x2719
  m.ret(10); // ret @0x2719
}
