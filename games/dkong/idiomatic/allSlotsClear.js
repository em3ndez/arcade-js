// SPDX-License-Identifier: GPL-3.0-only
/**
 * allSlotsClear — is a strided table of ten object slots fully cleared?
 *
 * The sole caller needs to know whether a group of ten object slots has been fully emptied
 * before it arms the next phase. This routine walks that group: ten cells starting at `base`,
 * stepping `stride` bytes each time, and reports whether every one of the ten bytes is zero.
 * Its caller drives it over the ten-record sprite-object block with a four-byte stride, so in
 * practice it answers "are all ten object sprites cleared?". Only the COUNT, ten, is
 * hard-wired; the base and stride are the caller's, which makes this a generic ten-cell
 * strided all-zero predicate.
 *
 * It short-circuits at the first non-zero cell — "that slot is still occupied" — and returns
 * false. That exit is a CALLER-SKIP: it does not return into the caller at all, it returns
 * past it, aborting the caller mid-flow. Here that is `return false`, which the caller
 * consumes as an early return. All ten zero returns true and the caller proceeds to arm the
 * next phase.
 *
 * A READ-ONLY LEAF: reads the ten cells, writes no memory, calls nothing.
 *
 * LIVE-OUT: the verdict only — true = all clear, caller continues; false = a slot is
 * occupied, caller aborts. No memory is written.
 */
export function allSlotsClear(mem, base, stride) {
  let addr = base & 0xffff;
  for (let slot = 0; slot < 10; slot++) {
    if (mem.read8(addr) !== 0) return false; // an occupied slot -> not clear (caller-skip)
    addr = (addr + stride) & 0xffff; // advance to the next slot, with 16-bit wrap
  }
  return true; // all ten slots empty
}

/**
 * The SEAM ENTRY — the export the override resolvers wire, which they dispatch as `fn(m)`.
 * The predicate above keeps its `(mem, base, stride)` shape for direct callers.
 *
 * The register ABI it unpacks: the table base and the stride arrive in the two pointer
 * register pairs; the count is not passed, it is the predicate's own hard-wired ten. What
 * comes back is the caller-skip verdict — true = all ten clear, caller continues; false = a
 * slot is occupied, caller aborts, and the machine's caller-skip seam consumes the extra
 * stack word that abort discards. Nothing is written to memory.
 *
 * THE TWO ARMS ARE NOT EQUALLY RECOVERABLE, and this wrapper treats them differently on
 * purpose.
 *
 *   ALL CLEAR — REGISTER-EXACT, and free. The walk's endpoint is fixed by the arm itself:
 *     the tenth cell it read was zero, so the accumulator is zero; the loop counter ran out,
 *     so it is zero; and the pointer advanced by the stride exactly ten times. Replaying the
 *     last two flag-setting operations — the zero test on that final cell, then the tenth
 *     pointer add, which rewrites half-carry/subtract/carry while leaving sign/zero/parity
 *     alone — reproduces the flag byte as well. This is the arm that MATTERS: control
 *     continues inside the caller, whose next act PRESERVES CARRY and then returns, so a
 *     carry left over from before the call really does escape the subtree. Measured: without
 *     this replay the flag byte differs at the caller's exit.
 *
 *   OCCUPIED (the caller-skip) — the residuals are DROPPED. Where the walk stopped is not
 *     recoverable from a boolean, and rebuilding it would mean re-walking the table inside
 *     the wrapper that exists to marshal into the predicate. So the stopping byte, the
 *     remaining count, the stopping address and the flags are all dropped. Control here does
 *     not continue inside the caller at all: the abort discards the caller's return and lands
 *     in the dispatcher continuation above it. PROVENANCE: that those dropped residuals are
 *     dead where control lands rests on reading that code, not on a measurement.
 */
export function allSlotsClearFromRegisters(m) {
  const { regs, mem } = m;
  const base = regs.hl;
  const stride = regs.de;

  if (!allSlotsClear(mem, base, stride)) return false; // caller-skip; residuals dropped, see above

  // The all-clear exit's register file, replayed from the walk's last pass.
  regs.a = 0x00; // the tenth cell, zero on this arm by definition
  regs.and(regs.a); // zero test: Z set, S clear, PV even, carry cleared
  regs.hl = (base + 9 * stride) & 0xffff; // the first nine pointer advances
  regs.addHl(stride); // the tenth — rewrites half-carry/subtract/carry, keeps the flags above
  regs.b = 0x00; // the loop counter ran out; running it out sets no flags
  return true;
}
