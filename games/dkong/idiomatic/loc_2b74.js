// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b74 — the reject arm of the tile-probe cascade: hand back a zeroed result and
 * unwind out of the probe and its caller.  ROM 0x2B74.
 *
 * Reached only from entry_2b29 (0x2b45 `jp nc,0x2b74`), the shared tail taken when the
 * probe's vertical delta is out of range. It forces the probe's two result registers to
 * zero and then UNWINDS: the oracle discards its own return address and returns one extra
 * level up, splicing straight past the probe's caller so the rest of that pass is skipped.
 * In direct-call form that non-local exit is a boolean — it returns false, the caller-skip
 * signal meaning "abort: no result this pass."
 *
 * The two zeroed registers are the probe's result, and they are LIVE: after the unwind the
 * consumer (the code just past loc_2b1c, at 0x1c08) reads them straight back — `dec a`
 * decides the first branch and, on a sibling arm, `dec b` the next — so the zero values
 * are the answer this arm reports, not dead scratch. The whole caller chain
 * (entry_2b29 -> loc_2b1c -> its 0x1c05 caller) is still the frozen translation, so those
 * two registers are genuine oracle-boundary ABI and stay as register writes here; they
 * dissolve into an honest return once that chain is decompiled.
 *
 * A LEAF: reads nothing, writes no memory, calls nothing — a constant function of no input
 * (its only "input" is the return stack it unwinds, which is dead scratch).
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle (zero the two result
 * registers, caller-skip unwind), but the probe cascade it serves is not yet grounded and
 * what the (0,0) result MEANS to the game is unconfirmed to the routine-name bar. Promote
 * once the collision/tile-probe subsystem is decompiled and corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b74.test.js.
 * GATE:     crafted-entry — the routine reads no input and is straight-line, so there is
 *           nothing to sweep; a real booted-attract machine is cloned with a controlled
 *           return stack and garbage in the result registers, then run oracle-vs-idiomatic
 *           on fresh clones. The oracle's two-level unwind (discard own return, then ret to
 *           the grandparent) is modeled on the candidate as one discarded pop + one net
 *           return so pc + SP line up. Plus a REALISM capture over a long attract run.
 * LIVE-OUT: the two result registers A (:= 0) and B (:= 0), plus the boolean unwind signal
 *           (false). Memory-only otherwise — it writes none. The residual HL (the discarded
 *           return address) and the flags are dead ABI; no consumer reads them.
 * NAMES:    none — touches no work RAM, so no names.js cell to import.
 */

export function loc_2b74(m) {
  const { regs } = m;

  // Report the "no result" answer: the probe's two result registers go to zero. The code
  // past the probe's caller reads these back directly, so they are live-out to the still-
  // translated caller chain (dissolves to a return value once that chain is decompiled).
  regs.a = 0;
  regs.b = 0;

  // Caller-skip: unwind out of the probe and its caller so the rest of the pass is skipped.
  // The JS boolean replaces the Z80 pop-hl/ret that splices two levels up.
  return false;
}
