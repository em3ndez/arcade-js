// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0da7 — hand-optimized rewrite of the translated routine at ROM 0x0DA7,
 * proven equal to its oracle by the equivalence harness. It touches only board-render
 * scratch (0x63AB/0x63AF/0x63B3/0x63B4, currently unnamed) and reaches VRAM through its
 * draw-primitive callees, so no ram.js name is imported.
 */

/**
 * sub_0da7 -- the board-layout table walker.  [ROM 0x0DA7-0x0DA6 loop]
 *
 * Walks a ROM layout table (pointed to by DE) one record at a time and draws the board.
 * Each record starts with a kind byte (stored to 0x63B3); the value 0xAA terminates the
 * walk. Otherwise it reads the record's two coordinate bytes into B/C, calls sub_2ff0
 * (0x2FF0) to resolve the tilemap start pointer (saved to 0x63AB, with DE preserved
 * across the call), derives the sub-tile phases 0x63B4 = B & 7 and 0x63AF = C & 7, reads
 * the length byte and (via `sub b`, negating on borrow) sets up the run, then dispatches
 * loc_0dd3 to decode+draw the record. loc_0dd3's chain ends by returning here (the ROM's
 * `jp 0x0da7` tail becomes a JS return up the call stack), so the `for(;;)` continues to
 * the next record.
 *
 * INPUTS : DE (layout table cursor), C (running column base). OUTPUTS: the drawn board
 *   (video RAM, via loc_0dd3/loc_0e19/loc_0e2a/loc_0e4f); 0x63AB/0x63AF/0x63B3/0x63B4
 *   left holding the last record's fields. Returns when the 0xAA terminator is hit.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (call/ret scaffolding kept verbatim,
 * per basic-block rules). Every straight-line run between conditionals is folded into one
 * charge; `jp nc` costs the oracle's 10 t whichever way it goes, so it is folded into
 * whichever arm it lands in rather than split at the branch. Per-path totals, each summed
 * and cross-checked against this file's own prior per-instruction charges (all previously
 * proven equal):
 *   kind-read+test 27 t; terminator `ret z` 11 t (total 38 t, the ONLY early exit);
 *   coords+push-de 58 t (ret-z-not-taken 5 + 8 coord ops 42 + push de 11); call 0x2ff0
 *   scaffold 17 t (kept verbatim, callee via m.call); pop de 10 t; phases+length+sub 85 t
 *   (ld (0x63ab),hl 16 + 10 ops 69); dispatch decision 10 t (no borrow) or 18 t (borrow,
 *   +neg). Total-preservation keeps the caller's cycle clock exact; only the mid-block PC
 *   snapshot an NMI would observe is coarsened, same as any collapse.
 *
 * sub_0da7 is called from many sites, including the intro/how-high steppers
 * loc_17b6/loc_1880, so atomicity is not provable on every path; see the equivalence
 * test for the (convergent, unconditionally) gate this routine runs under.
 */
export function sub_0da7(m) {
  const { regs, mem } = m;

  for (;;) {
    // record kind -> 0x63B3; 0xAA ends the walk.
    regs.a = mem.read8(regs.de);
    mem.write8(0x63b3, regs.a);
    regs.cp(0xaa);
    m.step(0x0dad, 27); // ld a,(de)[7] + ld (0x63b3),a[13] + cp 0xaa[7]
    if (regs.fZ) {
      m.ret(11); // ret z -- terminator (total 38 t)
      return;
    }

    // two coordinate bytes -> H/B and L/C.
    regs.de = (regs.de + 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.h = regs.a;
    regs.b = regs.h;
    regs.de = (regs.de + 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.l = regs.a;
    regs.c = regs.l;

    // resolve the tilemap start pointer via sub_2ff0 (DE saved) -> 0x63AB.
    m.push16(regs.de);
    // ret z NOT taken[5] + inc de/ld a,(de)/ld h,a/ld b,h/inc de/ld a,(de)/ld l,a/ld c,l
    // (8 ops, 42 t) + push de[11] = 58 t.
    m.step(0x0db7, 58);
    m.push16(0x0dba);
    m.step(0x2ff0, 17);
    m.call(0x2ff0);
    regs.de = m.pop16();
    m.step(0x0dbb, 10);
    mem.write16(0x63ab, regs.hl);

    // sub-tile phases: 0x63B4 = B & 7, 0x63AF = C & 7; length byte -> H; H -= B.
    regs.a = regs.b;
    regs.and(0x07);
    mem.write8(0x63b4, regs.a);
    regs.a = regs.c;
    regs.and(0x07);
    mem.write8(0x63af, regs.a);
    regs.de = (regs.de + 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.h = regs.a;
    regs.sub(regs.b);
    // ld (0x63ab),hl[16] + ld a,b/and 7/ld (0x63b4),a/ld a,c/and 7/ld (0x63af),a/
    // inc de/ld a,(de)/ld h,a/sub b (10 ops, 69 t) = 85 t.
    m.step(0x0dce, 85);

    if (regs.fNC) {
      m.step(0x0dd3, 10); // jp nc taken
    } else {
      regs.neg();
      m.step(0x0dd3, 18); // jp nc NOT taken[10] + neg[8] (ED-prefixed)
    }

    // decode + draw this record; loc_0dd3's chain returns here to continue the walk.
    m.call(0x0dd3);
  }
}
