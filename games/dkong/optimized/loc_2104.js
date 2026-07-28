// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2104 — hand-optimized rewrite of the translated routine at ROM 0x2104,
 * proven equal to its oracle by the equivalence harness. It is the OFF-SCREEN
 * BOUNDS GATE of the object-update cascade: it tests an object's X field
 * ((ix+3) + 8) and either hands the still-on-screen object to the animation-delay
 * tail loc_1fce, or DEACTIVATES the slot (clears (ix+0) and (ix+3)) and falls into
 * the shared object-sprite tail loc_21ba.
 *
 * It touches only per-object RECORD fields through IX ((ix+3), (ix+0)) and two tail
 * jumps, so it imports no name from ram.js — the ix-relative offsets stay raw hex
 * (the record-offset trap; see the report: no ram.js naming candidate).
 */

// Object-record field offsets. IX points at the current object record (the per-slot
// base sub_1f72 walks). These are IX-relative RECORD fields, so they stay raw hex —
// ram.js names ABSOLUTE addresses, not per-object record offsets (same convention as
// loc_1f83's SLOT_STATE = 0x00 and branch_1fe5's SLOT_X = 0x03). Neither is a ram.js
// naming candidate.
const SLOT_STATE = 0x00; // ix+0: 1 = active object slot; written 0 here to deactivate it
const SLOT_X = 0x03;     // ix+3: object X coordinate field (also copied to the sprite record)

/**
 * loc_2104 -- bounds-check (ix+3)+8; NC (>=0x10) -> loc_1fce, else deactivate the slot
 * and jp 0x21ba.  [ROM 0x2104-0x2117]
 *
 *   2104  dd 7e 03      ld   a,(ix+0x03)   ; A = object X (SLOT_X)
 *   2107  c6 08        add  a,0x08         ; A += 8  (8-bit wrap; sets carry/flags)
 *   2109  fe 10        cp   0x10           ; carry iff A < 0x10 (object has run off-screen)
 *   210b  d2 ce 1f     jp   nc,0x1fce      ; still on-screen -> the animation-delay tail
 *   210e  af           xor  a              ; --- off-screen --- A = 0
 *   210f  dd 77 00     ld   (ix+0x00),a    ; SLOT_STATE := 0  (deactivate this slot)
 *   2112  dd 77 03     ld   (ix+0x03),a    ; SLOT_X    := 0
 *   2115  c3 ba 21     jp   0x21ba         ; -> loc_21ba (shared object-sprite tail)
 *
 * WHAT IT DOES. This is the bounds gate reached two ways, BOTH internal to the object
 * cascade: branch_20ec's `jp c` at 0x20F7 (a proximity test failed), and loc_2101's
 * fall-through (0x2103, after its `call 0x24b4`). It reads the object's X coordinate,
 * adds 8 (a half-sprite margin), and asks whether the result is still >= 0x10:
 *   - NC (A >= 0x10) -> the object is on-screen; tail-jump to loc_1fce, which ticks the
 *     object's animation-delay counter and then falls into loc_21ba.
 *   - C  (A <  0x10) -> the object has walked off the left edge; DEACTIVATE it by zeroing
 *     its state byte (ix+0) and X (ix+3), then tail-jump straight to loc_21ba.
 * Either way it tail-jumps (`jp`, no push): loc_1fce's / loc_21ba's own `ret` returns to
 * the cascade's caller, so loc_2104 never returns to its own caller. It forwards the tail's
 * (skip-capable) return value via `return m.call(...)`.
 *
 * INPUTS  : IX (current object-record base; not modified here). RAM read: (ix+3) always.
 * OUTPUTS : A ((ix+3)+8 on the on-screen arm; 0 on the deactivate arm), F (see FLAGS),
 *           RAM (ix+0)=0 and (ix+3)=0 on the DEACTIVATE arm only, PC = 0x1FCE or 0x21BA,
 *           SP unchanged (both tails are bare `jp` m.calls — no push/ret here).
 *
 * FLAGS -- all three flag writers are load-bearing and KEPT verbatim (no droppable churn):
 *   - `add a,0x08` produces the value CP then compares, so it must run to set A.
 *   - `cp 0x10` sets the carry the branch reads (NC/C). On the ON-SCREEN arm it is also the
 *     LAST flag writer before the tail (`jp nc` / the tail `jp` touch no flags), so the exit
 *     F handed to loc_1fce IS the cp result and must match. A there = (ix+3)+8, also observable.
 *   - on the DEACTIVATE arm `xor a` (A=0) is the LAST flag writer before the tail (the two
 *     `ld (ix+d),a` and the `jp` touch no flags), so the exit F there is the xor result and
 *     A = 0. `cp`'s flags are overwritten by the xor on this arm.
 *   Nothing to drop; the readability win is the docstring, the named record fields, the
 *   structured branch, and the cycle collapse (matching SCC siblings loc_1fce / loc_1f83).
 *
 * CYCLES -- COLLAPSED to ONE m.step per arm TOTAL, placed immediately before the tail `jp`
 * (m.call). Licensed because the routine writes only WORK RAM ((ix+0)/(ix+3) are per-object
 * record bytes -- NOT a tagged hardware latch 0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 /
 * 0x7d80-87), so no hardware-bus cycle pins an intermediate boundary, and the only control
 * transfers are the two terminal tail jumps (no mid-body m.call/push16/ret). Each arm folds
 * to a single charge equal to the oracle's exact sum (the oracle spreads it across 4 / 8
 * per-instruction m.steps -- both totals confirmed by measuring the oracle in isolation):
 *   - ON-SCREEN (NC, jp nc TAKEN)  : ld(19)+add(7)+cp(7)+jp nc taken(10)              = 43 t
 *   - DEACTIVATE (C, jp nc NOT taken): ld(19)+add(7)+cp(7)+jp nc NT(10)+xor(4)
 *                                      +ld(ix+0),a(19)+ld(ix+3),a(19)+jp 0x21ba(10)   = 95 t
 * Both totals equal the oracle's exactly, so the frame's cycle budget -- hence the main-loop
 * spin count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- why the collapse is licensed by the STRICT gate).
 * loc_2104 sits in the loc_197a NMI object-update cascade (branch_20ec -> loc_2104). Probed
 * over 1400 attract frames: loc_2104 dispatches 171x (first entry frame 613, once the attract
 * demo starts PLAYING 25m). It is ATOMIC: every one of the 171 dispatches occurs INSIDE the
 * NMI handler with the NMI mask CLEARED (io.nmiMask == 0 at 171/171; mask-set 0), so the
 * interrupt cannot re-enter -- and correspondingly the NMI's pushed PC NEVER lands in the body
 * [0x2104,0x2117] (0 landings over 1394 NMIs). An atomic byte-exact collapse pushes no mistimed
 * PC and tears no raster, so it passes the STRICT (byte-exact) whole-machine gate directly
 * (docs/decompiler-pipeline), like SCC siblings loc_1fce / loc_1f83 / loc_21ba.
 *
 * BRANCH COVERAGE. The attract run reaches ONLY the ON-SCREEN arm (NC -> loc_1fce fires
 * 171/171; the objects never walk off-screen in that window, so the DEACTIVATE arm fires 0x).
 * The DEACTIVATE arm is therefore proven by a SYNTHESISED identical-both-sides entry (poke
 * (ix+3) below 8 so (ix+3)+8 < 0x10), asserting EQUAL over RAM + full register file + pc + SP
 * AND its exact 95 t cycle total, with the tail loc_21ba stubbed identically on both sides.
 * See equivalence-2104.test.js.
 */
export function loc_2104(m) {
  const { regs, mem } = m;
  const ix = regs.ix; // IX is not modified in this routine (no add ix)

  // (ix+3 = SLOT_X) + 8, then cp 0x10: carry iff the result < 0x10 (object off the left edge).
  // add mutates A to the compared value; cp sets the branch carry (and, on the on-screen arm,
  // the exit F). Both are kept verbatim so A and F match the oracle at the tail boundary.
  regs.a = mem.read8((ix + SLOT_X) & 0xffff); // ld a,(ix+0x03)
  regs.add(0x08);                             // add a,0x08
  regs.cp(0x10);                              // cp 0x10

  if (regs.fNC) {
    // ON-SCREEN: (ix+3)+8 >= 0x10 -> hand off to the animation-delay tail loc_1fce.
    // Collapsed: ld(19)+add(7)+cp(7)+jp nc taken(10) = 43 t, landing PC at 0x1FCE.
    m.step(0x1fce, 43);
    return m.call(0x1fce); // TAIL jump (no push16): loc_1fce's ret returns to OUR caller.
  }

  // DEACTIVATE: off the left edge -> zero the slot's state byte and X, then the shared tail.
  regs.xor(regs.a);                             // xor a -> A = 0 (LAST flag writer -> exit F)
  mem.write8((ix + SLOT_STATE) & 0xffff, regs.a); // ld (ix+0),a -- deactivate this slot
  mem.write8((ix + SLOT_X) & 0xffff, regs.a);     // ld (ix+3),a
  // Collapsed: ld(19)+add(7)+cp(7)+jp nc NT(10)+xor(4)+ld(ix+0),a(19)+ld(ix+3),a(19)+jp(10) = 95 t.
  m.step(0x21ba, 95);
  return m.call(0x21ba); // TAIL jump (no push16): loc_21ba's ret returns to OUR caller.
}
