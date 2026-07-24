// SPDX-License-Identifier: GPL-3.0-only
/**
 * handler_05e9 — hand-optimized rewrite of the translated routine at ROM 0x05E9,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. This routine has no callees (the sub_0020 tail is inlined
 * at the terminator), so it makes no `m.call`. All constants below are ROM literals.
 */

// -- handler_05e9 constants (ROM literals; NOT work-RAM, so none are in ram.js) --
const STRING_PTR_TABLE = 0x364b; // base of the 05e9 pointer table (indexed by payload*2)
const VRAM_ROW_STEP = 0xffe0; //   -32: back one tilemap row per char (vertical draw)
const STRING_TERMINATOR = 0x3f; // sentinel byte ending the character run
const BLANK_TILE = 0x10; //        tile written in the "blank the string" mode (bit 7 of payload)
const TABLE_INDEX_MASK = 0x7f; //  `and 0x7f` after `add a,a` -- keep the doubled index, drop bit 8

/**
 * handler_05e9 -- task table entry 3: draw a string.  [ROM 0x05E9-0x0610]
 *
 * A doubly-indirected vertical string draw. The dispatch payload in A selects
 * an entry in the pointer table at 0x364B (word-addressed: `add a,a` doubles the
 * index). That entry points to a descriptor whose first word is the VRAM
 * destination and whose following bytes are the characters. The destination
 * pointer steps back one tilemap row (-32) per character, so the string is drawn
 * VERTICALLY -- as you would expect on a screen the hardware rotates 270 degrees.
 *
 * 0x3F terminates the run. The terminator exit is `jp z,0x0026` -- a jump into
 * the TAIL of sub_0020 (`pop hl / ret`), inlined here. It is a NORMAL return:
 * at that point the stack is [return-addr, AF] because the prologue `push af`
 * is still outstanding (the loop's balancing `pop af` is AFTER the terminator
 * check), so `pop hl` discards THAT push-af value -- not the return address --
 * and `ret` goes to the immediate caller.
 *
 * The `push af` (before the `and`) carries bit 7 of the payload -- via the
 * carry set by `add a,a` -- across every loop iteration (pop af / re-push af).
 * When set, each cell is overwritten with the blank tile 0x10 after the
 * character is stored (a "blank the string" mode); when clear, the character
 * stands. The value is constant for the whole string.
 *
 * LADDER STATUS -- COLLAPSED (one m.step per basic block). A prior review found
 * that collapsing to one TOTAL PER PATH diverges under a strict whole-machine
 * gate: the vblank NMI fires INSIDE the loop on a frame-6 dispatch, and the
 * oracle pushes PC 0x060d (the boundary after `push af`) onto the stack --
 * diffed work RAM -- while a per-iteration charge has PC 0x0600 at that instant,
 * pushing a different (but equally valid, coarser) return address. That is
 * exactly the INTERRUPTIBLE-collapse signature the CONVERGENT gate exists for
 * (docs/06): the pushed PC lands in the dead stack scratch [0x6be0,0x6c00)
 * (excluded), the divergence heals, and no persistent non-stack state or pixel
 * divergence survives. So this routine is now collapsed and gated by
 * convergentGate rather than the strict whole-machine gate (see the
 * accompanying equivalence test) -- unlike handler_05c6 (short enough that the
 * NMI never lands inside it and stays byte-exact), handler_05e9 is long enough
 * to be interrupted every dispatch.
 *
 * PATH TOTALS (unchanged by the collapse, still exact): prologue 118, drawing
 * iter 93 (carry clear, no blank) / 98 (carry set, extra `ld (hl),0x10`),
 * terminator 44 -- cross-checked against the oracle's measured 1092 =
 * 118 + 10*93 + 44 for payload 4's 10-char string.
 *
 * The push/pop stack idioms are load-bearing regardless: the unit harness
 * compares the stack byte at 0x6BFC (SP=0x6BFE on entry) AND the full register
 * file, including HL, which the terminator's `pop hl` sets. No callees: the
 * sub_0020 tail is inlined, so nothing is imported for it.
 */
export function handler_05e9(m) {
  const { regs, mem } = m;

  // -- prologue: resolve payload -> descriptor -> (VRAM dest, char source) --
  // Folded into ONE step; total is the oracle's EXACT sum of the 17 prologue
  // instructions (10+4+11+7+4+7+11+7+6+7+4+7+6+7+6+10+4 = 118 t), exit at the
  // loop's first instruction (0x0600).
  regs.hl = STRING_PTR_TABLE;
  regs.add(regs.a); // add a,a -- doubles the index; bit 7 of payload -> carry
  m.push16(regs.af); // save the carry (blank-mode flag) across the loop
  regs.and(TABLE_INDEX_MASK);
  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de); // hl -> pointer-table entry
  regs.e = mem.read8(regs.hl); // de = descriptor address (16-bit table entry)
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  regs.exDeHl(); // hl -> descriptor
  regs.e = mem.read8(regs.hl); // de = VRAM destination (descriptor's first word)
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff; // hl -> first character byte
  regs.bc = VRAM_ROW_STEP;
  regs.exDeHl(); // hl = VRAM dest (write ptr), de = char source ptr
  m.step(0x0600, 118);

  // -- loop: copy chars until the 0x3F terminator, stepping up one row each --
  for (;;) {
    // BB_a: ld a,(de)(7)+cp 0x3f(7) = 14 t, exit @ the jp z (0x0603).
    regs.a = mem.read8(regs.de);
    regs.cp(STRING_TERMINATOR);
    m.step(0x0603, 14);
    if (regs.fZ) {
      // Terminator: jp z taken(10) + inlined sub_0020 tail's pop hl(10) + ret(10) = 30 t.
      // `pop hl` discards the outstanding prologue push-af; `ret` returns to the
      // immediate caller. NORMAL return.
      regs.hl = m.pop16();
      m.ret(30);
      return;
    }

    // BB_b: jp z NOT taken(10)+store the character(7)+pop af, restore carry(10) = 27 t,
    // exit @ the point the carry check reads (0x0608).
    mem.write8(regs.hl, regs.a); // store the character
    regs.af = m.pop16(); // restore the blank-mode carry
    m.step(0x0608, 27);

    if (regs.fNC) {
      m.step(0x060c, 12); // carry clear: keep the character (jr nc taken)
    } else {
      mem.write8(regs.hl, BLANK_TILE); // carry set: overwrite with the blank tile
      m.step(0x060c, 17); // jr nc NOT taken(7)+ld (hl),0x10(10) = 17 t
    }

    // Shared tail: push af(11)+inc de(6)+add hl,bc(11)+jr 0x0600(12) = 40 t.
    m.push16(regs.af); // re-save the carry for the next iteration
    regs.de = (regs.de + 1) & 0xffff; // next char
    regs.addHl(regs.bc); // dest up one tilemap row (-32)
    m.step(0x0600, 40);
  }
}
