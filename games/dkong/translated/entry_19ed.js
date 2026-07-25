// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_19ed  (ROM 0x19ED–0x1A06) — the confirm half of sub_19da's object-slot scan.
 * Reached ONLY via sub_19da's `jp z,0x19ed` @0x19E3 (X-match), with HL LIVE-IN =
 * the matched 0x6A0C-array slot ptr (do NOT default it). Confirms player-Y == (slot+3)
 * and bit 3 of (slot+1) CLEAR (eligible); if both pass, registers the hit -- (0x6343)=slot
 * ptr, (0x6342)=0, (0x6340)=1 -- the same shared "player hit an object" flags sub_1a33
 * (edge pickup) writes. Leaf. Reached by jp+ret, so its ret returns to sub_19da's caller.
 * NOTE: the two `ret nz` guards are 11T taken / 5T not-taken (draft skeleton had these
 * swapped; corrected to the Z80 timing / sub_2fcb convention).
 */
export function entry_19ed(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6205);
  m.step(0x19f0, 13); // ld a,(0x6205) -- player Y
  regs.l = regs.inc8(regs.l);
  m.step(0x19f1, 4); // inc l -- slot+1
  regs.l = regs.inc8(regs.l);
  m.step(0x19f2, 4); // inc l -- slot+2
  regs.l = regs.inc8(regs.l);
  m.step(0x19f3, 4); // inc l -- slot+3
  regs.cp(mem.read8(regs.hl));
  m.step(0x19f4, 7); // cp (hl) -- player Y == (slot+3)?
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- no Y match
  m.step(0x19f5, 5); // ret nz NOT taken
  regs.l = regs.dec8(regs.l);
  m.step(0x19f6, 4); // dec l -- slot+2
  regs.l = regs.dec8(regs.l);
  m.step(0x19f7, 4); // dec l -- slot+1
  const flagged = regs.bit(3, mem.read8(regs.hl));
  m.step(0x19f9, 12); // bit 3,(hl) -- enable/consumed flag
  if (flagged) { m.ret(11); return; } // ret nz -- bit 3 SET, object not eligible
  m.step(0x19fa, 5); // ret nz NOT taken
  regs.l = regs.dec8(regs.l);
  m.step(0x19fb, 4); // dec l -- slot+0 (base)
  mem.write16(0x6343, regs.hl);
  m.step(0x19fe, 16); // ld (0x6343),hl -- hit-slot ptr
  regs.xor(regs.a);
  m.step(0x19ff, 4); // xor a
  mem.write8(0x6342, regs.a);
  m.step(0x1a02, 13); // ld (0x6342),a -- := 0
  regs.a = regs.inc8(regs.a);
  m.step(0x1a03, 4); // inc a
  mem.write8(0x6340, regs.a);
  m.step(0x1a06, 13); // ld (0x6340),a -- := 1 (hit registered)
  m.ret(10);
}
