// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b29  (ROM 0x2B29–0x2B9A) — (player-vs-tilemap collision probe; CALLER-SKIP).
 * (0x6227)==1 -> probe (X,Y+7); else -> loc_2b53 probe (X-3,Y+7) + (D+7,E). Calls
 * entry_2b9b (tile classifier) up to 3x. Returns a BOOLEAN under the caller-skip
 * convention: true = normal return (0x2B70 ret z) so entry_2b1c continues; false =
 * a pop-hl/ret skip (0x2B51/0x2B74/0x2B99) OR an entry_2b9b DOUBLE-skip (entry_2be1
 * A<=C: pop x2 + ret two frames up), both of which unwind past entry_2b1c.
 *
 * ** entry_2b9b's double-skip (=== false) does its own pop x2 + ret; we
 *    just propagate `return false` here (no extra stack op) so the JS control flow
 *    mirrors the ROM's 2-frame unwind. entry_2b1c's `if (!x) return` completes it. **
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_2b29(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6227);
  m.step(0x2b2c, 13); // ld a,(0x6227)
  regs.a = regs.dec8(regs.a);
  m.step(0x2b2d, 4); // dec a
  if (regs.fNZ) { m.step(0x2b53, 10); return m.call(0x2b53); } // jp nz,0x2b53
  m.step(0x2b30, 10);

  // -- (0x6227)==1 arm: probe (X, Y+7) --
  regs.a = mem.read8(0x6203);
  m.step(0x2b33, 13); // ld a,(0x6203)
  regs.h = regs.a;
  m.step(0x2b34, 4); // ld h,a
  regs.a = mem.read8(0x6205);
  m.step(0x2b37, 13); // ld a,(0x6205)
  regs.add(0x07);
  m.step(0x2b39, 7); // add a,0x07
  regs.l = regs.a;
  m.step(0x2b3a, 4); // ld l,a
  m.push16(0x2b3d); m.step(0x2b9b, 17); // call 0x2b9b
  if (m.call(0x2b9b) === false) return false; // entry_2be1 DOUBLE-skip -> unwound past 2b29+2b1c
  regs.and(regs.a);
  m.step(0x2b3e, 4); // and a
  if (regs.fZ) { m.step(0x2b51, 10); return m.call(0x2b51); } // jp z,0x2b51 (reject A==0)
  m.step(0x2b41, 10);
  regs.a = regs.e; // E = original L (Y+7)
  m.step(0x2b42, 4); // ld a,e
  regs.sub(regs.c); // C = entry_2be1's column
  m.step(0x2b43, 7); // sub c
  regs.cp(0x04);
  m.step(0x2b45, 7); // cp 0x04
  if (regs.fNC) { m.step(0x2b74, 10); return m.call(0x2b74); } // jp nc,0x2b74
  m.step(0x2b48, 10);
  regs.a = regs.c;
  m.step(0x2b49, 4); // ld a,c
  regs.sub(0x07);
  m.step(0x2b4b, 7); // sub 0x07
  mem.write8(0x6205, regs.a); // (0x6205) = C - 7
  m.step(0x2b4e, 13);
  regs.a = 0x01;
  m.step(0x2b50, 7); // ld a,0x01
  regs.b = regs.a; // B = 1
  m.step(0x2b51, 4); // ld b,a -- falls into loc_2b51
  return m.call(0x2b51);
}
