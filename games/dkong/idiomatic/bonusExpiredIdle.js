// SPDX-License-Identifier: GPL-3.0-only
/**
 * bonusExpiredIdle — the idle (do-nothing) arm of the bonus-expired state machine.  ROM 0x1A1E.
 *
 * A single-byte `ret`. It takes no inputs, reads and writes no memory, and just
 * returns to its caller. entry_1a07 (ROM 0x1A07) dispatches an rst-0x28 inline jump
 * table on BONUS_EXPIRED_STEP (0x6386, values 0..3): idx0 -> 0x1A1E (THIS), idx1 ->
 * loc_1a15 (INIT: clear BONUS_EXPIRED_DELAY 0x6387, advance the step to 2), idx2 ->
 * loc_1a1f (DELAY: count that counter down, advance to step 3), idx3 -> 0x1A2A. THIS
 * is idx0 — the arm taken while the step is 0, i.e. every frame the on-screen BONUS
 * has not yet reached zero. Both bonus-decrement sites (entry_2cb8, sub_2fcb) set the
 * step to 1 the moment BONUS hits 0, kicking the sequence off; until then the machine
 * sits in state 0 and this no-op runs, so the router does nothing that frame.
 *
 * NAME PROMOTED (vs a neutral loc_): unlike the structural twin loc_1e49 — whose
 * router byte 0x6340 = EFFECT_STATE carries only a [code]-level ram.js name whose
 * game-semantics are still to be grounded, so that twin kept a loc_ name — this arm's
 * router byte 0x6386 = BONUS_EXPIRED_STEP is a RAM name confirmed by both verifiers,
 * and the bonus-expired sequence's purpose is established, so the ROLE is earned, not
 * guessed. Both facts (the byte's identity and that step 0 is the pre-expiry idle) are
 * ROM-cited via entry_1a07's table. (A reviewer preferring
 * maximal conservatism can fall back to loc_1a1e — the mechanics are identical either
 * way; only the label's confidence differs.)
 *
 * In the idiomatic layer the Z80 `ret` IS the JS return, so the body is empty: there is
 * no stack to pop and no pc/SP to maintain — the caller, once decompiled, calls this
 * directly. The oracle's `ret` only READS two stack bytes (never writes) and on every
 * real dispatch those bytes live in STACK_SCRATCH, so it leaves no memory residue
 * either. A pure, total no-op over every machine state (branchless).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a1e.test.js.
 * GATE:     crafted-entry — branchless no-op. Real captured attract dispatches (via
 *           entry_1a07 while BONUS_EXPIRED_STEP == 0; ~1197 over 2000 frames, entry SP
 *           0x6bea-0x6bee, all inside STACK_SCRATCH) + a crafted entry whose SP points
 *           into ordinary work RAM (return bytes in the COMPARED region) to prove the
 *           ret's pop is READ-ONLY there too. Compared on RAM-STACK_SCRATCH + pc + SP;
 *           the harness supplies the matching ret so pc/SP line up. Teeth: a
 *           stray-memory-write twin and an extra-stack-pop twin, both caught.
 * LIVE-OUT: memory-only — and there is none. The routine writes no memory, and its
 *           caller (entry_1a07 -> loc_197a @0x19BF) reads no register/flag on return (it
 *           proceeds straight to the next call, 0x2FCB), so there is no live register or
 *           flag out. The oracle's residual A/flags are dead ABI.
 * NAMES:    BONUS_EXPIRED_STEP (0x6386) — the dispatcher's state byte, referenced only
 *           in this prose; not touched here (this arm reads and writes nothing).
 */
export function bonusExpiredIdle(_m) {
  // A no-op: the Z80 `ret` becomes the JS return. No stack pop, no pc/SP bookkeeping,
  // no memory touched. entry_1a07's dispatch on BONUS_EXPIRED_STEP == 0 lands here and
  // does nothing. The machine argument is accepted (this is a machine routine by
  // signature) but deliberately unused.
}
