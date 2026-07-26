// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2bf2  (ROM 0x2bf2-0x2c01, The Pit) -- scans the 24-entry table at work RAM
 * 0x80c3 for the FIRST non-zero entry (a "is anything pending?" guard).
 *
 * HL walks 0x80c3..0x80da (B = 0x18 = 24 counts). Each pass loads the entry into A
 * and tests it with `and a` (A unchanged, Z set iff the entry is 0):
 *   - non-zero entry found -> `jr nz,0x2c04`: hand off to the placement path at
 *     loc_2c04, leaving HL pointing AT the found entry and A holding its value.
 *   - all 24 entries zero   -> fall out of the `djnz` loop with A = 0 (the last
 *     entry read), store A to 0x80bd (clears the pending flag), and tail-jump to
 *     0x2f71 to continue. (Role is best-effort from the code; the address, the
 *     24-count scan, the found/none split and the control flow are exact.)
 *
 * CONTROL FLOW -- two exits, both modelled as TAIL-JUMPS (loc_2bf2 keeps no frame
 * of its own; it is itself entered by `jp z,0x2bf2` from 0x29c8, another tail-jump):
 *   - `jp 0x2f71` (all-zero exit): `m.step(0x2f71,10); return m.call(0x2f71)` with
 *     NO trailing m.ret -- 0x2f71's own ret returns to loc_2bf2's caller; a second
 *     ret would double-pop.
 *   - `jr nz,0x2c04` (found exit): loc_2c04 begins a separate, large placement
 *     routine reached ONLY from here. It is treated as its own ROM routine, so the
 *     conditional jump is a conditional tail-jump: `m.step(0x2c04,12); return
 *     m.call(0x2c04)`. When loc_2c04's block eventually rets it returns to
 *     loc_2bf2's caller -- exactly the tail-jump semantics. It is NOT inlined here:
 *     that would fold an entire other routine into this one.
 *
 * A is genuinely 0 at the `ld (0x80bd),a` store: the loop only falls through when the
 * last `and a` set Z (entry == 0), so `jr nz` was not taken on the final entry.
 *
 *   2bf2  21 c3 80     ld   hl,0x80c3
 *   2bf5  06 18        ld   b,0x18
 * loc_2bf7:
 *   2bf7  7e           ld   a,(hl)
 *   2bf8  a7           and  a
 *   2bf9  20 09        jr   nz,0x2c04
 *   2bfb  23           inc  hl
 *   2bfc  10 f9        djnz 0x2bf7
 *   2bfe  32 bd 80     ld   (0x80bd),a
 *   2c01  c3 71 2f     jp   0x2f71
 */
export function loc_2bf2(m) {
  const { regs, mem } = m;

  // 2bf2  ld hl,0x80c3 -- point HL at the 24-entry pending table
  regs.hl = 0x80c3;
  m.step(0x2bf5, 10);
  // 2bf5  ld b,0x18 -- scan count = 24 entries
  regs.b = 0x18;
  m.step(0x2bf7, 7);

  // loc_2bf7: scan for the first non-zero entry
  for (;;) {
    // 2bf7  ld a,(hl) -- current table entry
    regs.a = mem.read8(regs.hl);
    m.step(0x2bf8, 7);
    // 2bf8  and a -- Z set iff the entry is zero (A unchanged)
    regs.and(regs.a);
    m.step(0x2bf9, 4);
    // 2bf9  jr nz,0x2c04 -- non-zero entry found: hand off to the placement path
    //   (conditional tail-jump; loc_2c04's ret returns to loc_2bf2's caller)
    if (regs.fNZ) {
      m.step(0x2c04, 12); // jr nz taken
      return m.call(0x2c04);
    }
    m.step(0x2bfb, 7); // jr nz not taken
    // 2bfb  inc hl -- advance to the next entry
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2bfc, 6);
    // 2bfc  djnz 0x2bf7 -- decrement B (no flags), loop while entries remain
    if (regs.djnz() !== 0) {
      m.step(0x2bf7, 13); // djnz taken -> next entry
      continue;
    }
    m.step(0x2bfe, 8); // djnz not taken -> all 24 entries were zero
    break;
  }

  // 2bfe  ld (0x80bd),a -- A is 0 here: clear the pending flag
  mem.write8(0x80bd, regs.a);
  m.step(0x2c01, 13);
  // 2c01  jp 0x2f71 -- tail-jump: 0x2f71's ret returns to loc_2bf2's caller
  m.step(0x2f71, 10);
  return m.call(0x2f71);
}
