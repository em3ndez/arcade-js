// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_11d3  (ROM 0x11D3–0x11EB) — 25 bytes, 15 instructions.
 *
 *   11d3  dd 7e 03     ld   a,(ix+0x03)
 *   11d6  77           ld   (hl),a
 *   11d7  2c           inc  l
 *   11d8  dd 7e 07     ld   a,(ix+0x07)
 *   11db  77           ld   (hl),a
 *   11dc  2c           inc  l
 *   11dd  dd 7e 08     ld   a,(ix+0x08)
 *   11e0  77           ld   (hl),a
 *   11e1  2c           inc  l
 *   11e2  dd 7e 05     ld   a,(ix+0x05)
 *   11e5  77           ld   (hl),a
 *   11e6  2c           inc  l
 *   11e7  dd 19        add  ix,de
 *   11e9  10 e8        djnz 0x11d3
 *   11eb  c9           ret
 *
 * FIVE call sites: 0x1046, 0x10DB, 0x117A, 0x119E, 0x11CF.
 *
 * Inputs, ALL caller-supplied and none initialised here: B = pass count,
 * HL = destination, IX = source base, DE = the IX stride.
 *
 * THE DJNZ TARGETS THE ROUTINE ENTRY. The first instruction of the routine is
 * also the first instruction of the loop, so there is no setup to hoist at all
 * -- the sub_3fa6 trap in its total form.
 *
 * A PERMUTING GATHER, NOT A BLOCK COPY. The source offsets are +3, +7, +8, +5
 * -- in that order, with +5 read AFTER +7 and +8, and +4 and +6 never read at
 * all -- written to four CONSECUTIVE destination bytes. A translation looping
 * over +3,+4,+5,+6 would look entirely reasonable and be wrong.
 *
 * Those four offsets are the same four sub_11fa writes, in the same order.
 * Recorded as an observation; what the structure is has not been established
 * and no code here depends on it.
 *
 * `inc l`, NOT `inc hl`: H is never modified anywhere in this routine, so L
 * advances 4 per pass and WRAPS WITHIN THE PAGE H selects. B0 >= 64 wraps L a
 * full page; whether any of the five callers can reach that is not established
 * here, and the routine has no defence against it.
 *
 * `add ix,de` is NOT a bare 16-bit add -- it writes H, N and C (and F3/F5) and
 * PRESERVES S, Z and PV. regs.addIx is required; `regs.ix = (regs.ix +
 * regs.de) & 0xffff` is arithmetically right and flag-wise wrong. That exact
 * defect was already found and fixed in this repo at mainloop.js:878.
 *
 * The carry from the FINAL `add ix,de` escapes to the caller: `djnz` and `ret`
 * write no flags and `inc l` preserves C. Do not record it as dead -- from
 * sub_11a6 it survives that routine's `ret` too, and dies only at the
 * `add a,c` inside a later sub_122a call. "No reader in this routine" is not
 * "no reader".
 *
 * B0 = 0 would give 256 passes, writing 1024 bytes through HL. Not defended
 * against, because no known call site does it.
 *
 * ── FLAGS AT THE ret, and they come from TWO different instructions ─────────
 *
 * "The flags are whatever the last instruction left" is the natural reading
 * and it is WRONG here, because `add ix,de` writes only three of them:
 *
 *   S   from the FINAL `inc l` (0x11E6)   -- bit 7 of L after the 4th increment
 *   Z   from the FINAL `inc l` (0x11E6)   -- set if that L wrapped to 0x00
 *   PV  from the FINAL `inc l` (0x11E6)   -- set if L went 0x7F -> 0x80
 *   H   from the FINAL `add ix,de` (0x11E7) -- carry out of bit 11
 *   N   from the FINAL `add ix,de` (0x11E7) -- always 0; `add` clears N
 *   C   from the FINAL `add ix,de` (0x11E7) -- the 16-bit carry, i.e. whether
 *       IX crossed 0xFFFF on the last pass
 *   F3/F5 (undocumented) from the final `add ix,de`, taken from result >> 8
 *
 * `add ix,rr` PRESERVES S, Z and PV -- confirmed against mame0288's z80.lst,
 * whose add16 macro is commented `// keep szv` -- and `djnz` and `ret` write
 * no flags at all, so the S/Z/PV set by the `inc l` four instructions earlier
 * survives the add, the branch and the return.
 *
 * ALL SIX ESCAPE TO THE CALLER. No caller is currently known to read them;
 * that is a fact about today's call sites, not about this routine, and it is
 * exactly the "no reader in this routine is not no reader" trap. The
 * implementation uses regs.inc8 and regs.addIx, so every one of these is
 * produced correctly whether or not anyone reads it.
 */
export function loc_11d3(m) {
  const { regs, mem } = m;

  do {
    // Loop body, NOT setup -- the djnz at 0x11E9 lands on the routine entry.
    // The offsets are +3, +7, +8, +5 IN THIS ORDER. Not a block copy.
    for (const [disp, afterLoad, afterInc] of [
      [0x03, 0x11d6, 0x11d8],
      [0x07, 0x11db, 0x11dd],
      [0x08, 0x11e0, 0x11e2],
      [0x05, 0x11e5, 0x11e7],
    ]) {
      regs.a = mem.read8((regs.ix + disp) & 0xffff);
      m.step(afterLoad, 19); // ld a,(ix+d)
      mem.write8(regs.hl, regs.a);
      m.step(afterLoad + 1, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l); // `inc l` -- H untouched, wraps in page
      m.step(afterInc, 4); // inc l
    }

    regs.addIx(regs.de); // writes H, N, C -- the carry escapes via the ret
    m.step(0x11e9, 15); // add ix,de

    regs.djnz();
    m.step(regs.b !== 0 ? 0x11d3 : 0x11eb, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 11eb
}
