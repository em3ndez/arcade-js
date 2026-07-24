// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2153 — hand-optimized rewrite of the translated routine at ROM 0x2153,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x21ba = loc_21ba, the shared object-sprite
 * tail, reached by the tail jump) is invoked through `m.call`, the routine registry
 * (games/dkong/routines.js), so it resolves to the oracle or to loc_21ba's own
 * optimized rewrite — never a copied implementation here. No named RAM addresses are
 * touched (the writes are IX-relative object-record fields, not absolute addresses),
 * so nothing is imported from ram.js.
 */

/**
 * loc_2153 -- clear three object-record fields, then TAIL-JUMP into the shared
 * object-sprite tail.  [ROM 0x2153-0x215C, then jp loc_21ba @ 0x21ba]
 *
 *   2153  fd 77 14     ld   (ix+0x14),a   ; field 0x14 := A
 *   2156  fd 77 04     ld   (ix+0x04),a   ; field 0x04 := A
 *   2159  fd 77 06     ld   (ix+0x06),a   ; field 0x06 := A
 *   215c  c3 ba 21     jp   0x21ba        ; TAIL jump into loc_21ba (no push)
 *
 * WHAT IT DOES. A shared join point in the sub_1f72 object-dispatch cluster (the
 * per-frame object scan @0x6700, stride 0x20, ten slots; runs on (0x6227)==1). Two
 * paths reach it, both via a tail `jp 0x2153`:
 *   - entry_2118 (the (ix+5) >= 0xE0 branch), and
 *   - loc_2146 (the (ix+5) < 0xE0 branch, after its 0x2407 / 0x22cb calls),
 * and BOTH set A := 0 with `xor a` immediately before jumping here. So in live play
 * this routine ZEROES object-record fields 0x14, 0x04 and 0x06 of the current slot,
 * then falls into loc_21ba which copies the slot's four sprite fields into the draw
 * buffer and re-enters sub_1f72's loop advance (0x1f8d).
 *
 * The routine itself does NOT assume A==0 -- it faithfully stores whatever A holds
 * into all three fields -- so the rewrite writes the live A (`value`), never a
 * hardcoded 0. (The unit CONTRACT test below pins this by driving A=0x5A and
 * checking all three fields take that value, matching the oracle.)
 *
 * INPUTS  : A (the fill value, 0 on both live entries); IX (object-record base,
 *           0x6700 + slot*0x20 in the live scan). The stack (a caller return
 *           address for loc_21ba's `ret` to land on).
 * OUTPUTS : RAM (ix+0x14), (ix+0x04), (ix+0x06) := A. Then loc_21ba's effects (the
 *           four sprite-field copies into the HL draw buffer + the tail into 0x1f8d).
 *           Register file: A/BC/DE/HL/IX/IY unchanged by THIS routine; PC/SP move via
 *           the tail call. F is UNTOUCHED -- `ld (ix+d),a` sets no flags -- so the
 *           whole register file (incl. F and the F3/F5 bits) matches the oracle.
 *
 * The three field offsets 0x14 / 0x04 / 0x06 stay as raw offsets on purpose: they are
 * per-slot object-record fields (IX-relative), not fields we have independent control
 * evidence for, and ram.js names ABSOLUTE addresses, not object-record offsets. See
 * the report -- no ram.js naming candidate is proposed.
 *
 * FLAGS -- nothing to preserve or drop: no instruction here writes a flag, so F is
 * carried through verbatim by doing nothing to it. A and every other register are
 * likewise untouched, so the register file is identical to the oracle's on return.
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole straight-line block (there are no
 * branches). The four instruction charges 19+19+19+10 = 67 t fold into a single
 * charge at the block-exit PC 0x21ba, exactly the oracle's total. total-preservation
 * keeps the main loop's spin count (0x6019, the PRNG entropy) deterministic.
 *
 * The three stores are all to WORK RAM (0x67xx in the live scan; IX never exceeds
 * 0x6820 at slot 9 of the ten, so ix+0x14 tops out at 0x6834) -- NOT a tagged hardware
 * latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87). So no hardware bus
 * cycle is hidden inside the block and the full collapse across the stores is safe;
 * there is no write-trace test to add.
 *
 * loc_2153 is NOT atomic: it runs inside sub_1f72, dispatched from the interruptible
 * per-frame update cascade loc_197a (@0x1986) AND during attract's demo play, so the
 * vblank NMI can land inside its 67 t window. The collapse is therefore LICENSED by
 * the CONVERGENT gate (docs/06; equivalence-2153.test.js uses convergentGate, not the
 * strict whole-machine gate): a mistimed NMI pushes the coarse block-exit PC into the
 * DEAD stack (excluded) and can leave a single-frame raster tear that heals next
 * frame; non-stack RAM stays byte-identical and nothing persistent survives.
 *
 * The `jp 0x21ba` is a TAIL jump with NO push16: loc_21ba's own `ret` (after its
 * `jp 0x1f8d` loop continuation eventually unwinds) returns to loc_2153's caller, not
 * to here. loc_21ba is reached via `m.call(0x21ba)` so it resolves to the oracle or to
 * its own optimized rewrite; it is left per-instruction because IT is interruptible
 * too. `return` propagates its answer (inert today; keeps a future reader honest).
 */
export function loc_2153(m) {
  const { regs, mem } = m;
  const obj = regs.ix; // object-record base (0x6700 + slot*0x20 in the live scan)
  const value = regs.a; // the fill value the caller passes in A (0 on both live entries)

  // Clear the three object-record fields.  No flags touched; A/IX unchanged.
  mem.write8((obj + 0x14) & 0xffff, value);
  mem.write8((obj + 0x04) & 0xffff, value);
  mem.write8((obj + 0x06) & 0xffff, value);

  // One collapsed charge for the whole block incl. the tail jp: 19+19+19+10 = 67 t,
  // exit PC 0x21ba.
  m.step(0x21ba, 67);
  // TAIL jump (jp, NO push16): loc_21ba's ret returns to OUR caller.
  return m.call(0x21ba);
}
