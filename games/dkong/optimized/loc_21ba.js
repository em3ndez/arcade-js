// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_21ba — hand-optimized rewrite of the translated routine at ROM 0x21BA,
 * proven equal to its oracle by the equivalence harness.
 *
 * This is the SHARED OBJECT-SPRITE TAIL: the convergence point that 13 `jp 0x21ba`
 * entries reach (9 arrive still `exx`'d from sub_1f72's per-slot dispatch branches,
 * 4 non-exx'd from loc_215f / entry_2118 / the 0x24xx bounds gate). It is the generic
 * per-OBJECT twin of entry_1da6, the player-hardcoded version — same 4-field copy into
 * a 0x69xx sprite-shadow record, but here the object record (IX) and the destination
 * buffer (HL) are passed in live rather than the fixed Mario record.
 *
 * NO RAM name is imported: the routine has ZERO address literals. The four sources are
 * per-object RECORD-FIELD offsets off the live IX (kept hex — the record-offset trap:
 * they are +3/+7/+8/+5 in the object's own layout, NOT sortable addresses), and the
 * destination base is the live HL the loop set up (a per-slot pointer into the 0x6980
 * object sprite-shadow region), so it stays in a register, not a literal. See the
 * naming note in the report.
 */

/**
 * The four object fields in the DELIBERATE sprite-record order the hardware wants:
 * +0 X (ix+0x03), +1 code (ix+0x07), +2 attr (ix+0x08), +3 Y (ix+0x05). This is the
 * object record's physical field layout — it is NOT sorted by offset and must not be.
 */
const RECORD_FIELDS = [0x03, 0x07, 0x08, 0x05];

/**
 * loc_21ba -- copy an object's four sprite fields into its display-buffer record,
 * then re-enter sub_1f72's slot-scan loop.  [ROM 0x21BA-0x21D0]
 *
 *   21ba  d9            exx                   ; restore the loop's MAIN register set
 *   21bb  dd 7e 03      ld   a,(ix+0x03)      ; A = field +0 (X)
 *   21be  77            ld   (hl),a           ; record +0 := X
 *   21bf  2c            inc  l                ; -> record +1 (inc L only: stays in-page)
 *   21c0  dd 7e 07      ld   a,(ix+0x07)      ; A = field +1 (code)
 *   21c3  77            ld   (hl),a           ; record +1 := code
 *   21c4  2c            inc  l                ; -> record +2
 *   21c5  dd 7e 08      ld   a,(ix+0x08)      ; A = field +2 (attr)
 *   21c8  77            ld   (hl),a           ; record +2 := attr
 *   21c9  2c            inc  l                ; -> record +3
 *   21ca  dd 7e 05      ld   a,(ix+0x05)      ; A = field +3 (Y)
 *   21cd  77            ld   (hl),a           ; record +3 := Y   (no inc l after the 4th)
 *   21ce  c3 8d 1f      jp   0x1f8d           ; re-enter sub_1f72's loop advance (SCC)
 *
 * WHAT IT DOES. Snapshots one object's live state (X, code, attribute, Y) into its
 * 4-byte record inside the sprite-shadow buffer HL points at. The i8257 DMA later blits
 * that whole buffer to sprite RAM 0x7000, so this copy is what makes the object visible.
 * Then it tail-jumps back into sub_1f72's per-slot loop advance (loc_1f8d) to continue
 * scanning the object table — the mutual-recursion SCC that walks all active slots.
 * Straight-line: NO branch, so exactly one path.
 *
 * THE LEADING exx IS A CONTRACT (modelled LITERALLY, not special-cased per caller). Nine
 * of the 13 entries reach here having exx'd into the SHADOW set to do their per-branch
 * work without unswapping; this `exx` is the downstream unswap that restores the loop's
 * MAIN set — HL (the destination buffer pointer), DE (slot stride), B (slot countdown) —
 * so loc_1f8d resumes with the loop state it expects. The four non-exx'd entries reach
 * here with the main set already live, and exx'ing back-and-forth is a no-op for them by
 * the same contract. `exx` swaps ONLY BC/DE/HL (core/cpu/z80.js): AF, IX, IY, SP are
 * untouched, so `(ix+d)` below still indexes the object record via the MAIN IX.
 *
 * INPUTS  : IX = object record base (the +3/+7/+8/+5 fields). After exx, HL = the object's
 *           4-byte destination record in the 0x69xx sprite-shadow buffer. Incoming carry
 *           (see FLAGS). The shadow register set (restored to main by exx).
 * OUTPUTS : RAM HL..HL+3 := (field+3, field+7, field+8, field+5) in that order. Registers
 *           on exit: HL = base+3 (L walked +3 via three in-page `inc l`), A = the last
 *           field read (ix+0x05), F = the last `inc l`'s S/Z/H/PV with carry preserved
 *           (see FLAGS), BC/DE = the loop's main-set values (via exx), IX/IY untouched.
 *           PC = 0x1F8D; control passes to loc_1f8d via m.call (the tail jp).
 *
 * REGISTER CHURN -- NONE is droppable, so A/HL/F are reproduced faithfully. A is the
 *   transport register (each read is immediately stored) and its FINAL value (field +5)
 *   is live at the m.call(0x1f8d) boundary, so it is kept. HL is the live destination
 *   pointer and ends base+3. `inc l` (not `inc hl`): only L advances, keeping HL inside
 *   its 0x69xx page. The readability win here is names + the copy loop + the docstring +
 *   the cycle collapse, NOT dropped registers. (The internal read/inc/write ORDER is the
 *   entry_1da6 reordering — inc-before-store — which is state-identical to the oracle's
 *   store-then-inc because the field reads have no side effects and the inc count is the
 *   same, so the same L values address the same stores and the same inc leaves the exit F.)
 *
 * FLAGS -- KEPT verbatim via inc8, because the exit F is OBSERVABLE and NOT droppable:
 *   the LAST `inc l` (advancing L to base+3) is the final flag-writer before the jp
 *   (`ld a`/`ld (hl)`/`jp` set no flags), so it defines the exit S/Z/H/PV. `inc` never
 *   touches carry, so the entry carry survives unchanged to the exit F — also observable.
 *   The unit gate compares the whole register file (incl. F and the undocumented F3/F5
 *   bits), so reproducing inc8's exact result is required, not optional.
 *
 * CYCLES -- FULLY COLLAPSED to ONE m.step for the whole straight-line run (exx + the four
 *   field copies + the tail jp), 130 t, landing PC at 0x1F8D immediately before the call:
 *     exx 4 + (ld a 19 + ld(hl) 7 + inc l 4)*3 + ld a 19 + ld(hl) 7 + jp 10 = 130 t,
 *   exactly the oracle's per-instruction sum. The four RAM writes are to the 0x69xx sprite
 *   SHADOW buffer (work RAM), NOT a tagged hardware latch (0x7800-0f / 0x7C00 / 0x7C80 /
 *   0x7D00-07 / 0x7D80-87) — the DMA blit to real sprite RAM 0x7000 happens later — so no
 *   hardware bus cycle is hidden inside the body and folding across the stores is safe.
 *   The m.call(0x1f8d) is kept verbatim: a TAIL jp pushes nothing and adds no CALL charge
 *   (its 10 t is already in the 130). total-preservation keeps the spin count 0x6019
 *   (PRNG entropy) deterministic, so the strict whole-machine gate stays byte-exact.
 *
 * REACHABILITY / ATOMICITY (MEASURED, not assumed — the oracle's "not yet wired / goes
 *   live at the finale" note is STALE; the swap layer wired sub_1f72's cascade). loc_21ba
 *   is dispatched deep in the loc_197a NMI update cascade via sub_1f72's per-slot object
 *   scan. Probed at 0x21BA over an all-oracle run: 121 entries by frame 720 (first at
 *   frame 612, once the attract demo starts PLAYING 25m), 1592 by frame 1200, 3346 by
 *   frame 1600 — VERY hot, so the whole-machine gate is strongly NON-vacuous. It is ATOMIC
 *   on EVERY measured call path: every single entry occurs INSIDE the NMI handler with the
 *   NMI mask CLEARED (in-NMI 3346/3346, mask-set 0/0), and the collapsed region [0x21BA,
 *   0x21CE] is a pure straight-line body with no intervening call, so the mask stays clear
 *   through it and the NMI cannot re-enter — correspondingly the NMI's pushed PC never
 *   lands in [0x21BA,0x21CE] (0 landings over 1600 frames). An atomic byte-exact collapse
 *   pushes no mistimed PC and tears no raster, so it passes the STRICT whole-machine gate
 *   directly and does NOT need the convergent gate (same evidence as the sibling
 *   entry_1da6 / loc_1f8d). See equivalence-21ba.test.js.
 */
export function loc_21ba(m) {
  const { regs, mem } = m;

  // Restore the loop's MAIN register set (HL buffer / DE stride / B count) for whichever
  // of the 13 callers reached here. exx swaps BC/DE/HL only; IX/AF/SP are untouched, so
  // the (ix+d) reads below still index the object record via the main IX.
  regs.exx();

  // Field +0 (X): point at the record base HL and copy — no `inc l` for the first byte.
  regs.a = mem.read8((regs.ix + RECORD_FIELDS[0]) & 0xffff); // ld a,(ix+0x03)
  mem.write8(regs.hl, regs.a); // ld (hl),a

  // Fields +1..+3 (code, attr, Y): each is `inc l` then copy. inc8 advances L in-page and
  // sets S/Z/H/PV (carry preserved); the final iteration leaves the observable exit F.
  for (let i = 1; i < RECORD_FIELDS.length; i++) {
    regs.a = mem.read8((regs.ix + RECORD_FIELDS[i]) & 0xffff);
    regs.l = regs.inc8(regs.l);
    mem.write8(regs.hl, regs.a);
  }

  // One collapsed charge for the entire branch-free run: exx 4 + 3*(19+7+4) + 19+7 +
  // jp 10 = 130 t, landing PC at 0x1F8D (atomic -> byte-exact; the 4 stores are work-RAM,
  // not hardware latches, so no inner bus-cycle boundary is pinned).
  m.step(0x1f8d, 130);
  return m.call(0x1f8d); // jp 0x1f8d -- re-enter sub_1f72's loop advance (tail, nothing pushed)
}
