// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e49 — the idle (do-nothing) arm of sub_1dbd's 0x6340 state router.  ROM 0x1E49.
 *
 * A single-byte `ret`. It takes no inputs, reads and writes no memory, and just
 * returns to its caller. sub_1dbd (ROM 0x1DBD) dispatches an rst-0x28 inline jump
 * table on the state byte 0x6340 (values 0..3); THIS is table entry 0 — the arm
 * taken while 0x6340 == 0. Entry 1 (loc_1dc9) advances that state, entry 2
 * (loc_1e4a) runs a countdown, entry 3 is the reset vector; entry 0 does nothing,
 * so the router is a no-op that frame. 0x6340 is unnamed engine scratch (a REJECT in
 * ram.js) and the sequence's purpose is not established, so the routine keeps its
 * neutral loc_ name: the MECHANICS are certain (a pure ret) but the ROLE is not.
 *
 * In the idiomatic layer the Z80 `ret` IS the JS return, so the body is empty: there
 * is no stack to pop and no pc/SP to maintain — the caller, once decompiled, calls
 * this directly. The oracle's `ret` only READS two stack bytes (never writes) and on
 * every real dispatch those bytes live in STACK_SCRATCH, so it leaves no memory
 * residue either. A pure, total no-op over every machine state (branchless).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e49.test.js.
 * GATE:     crafted-entry — branchless no-op. 64 real captured attract dispatches
 *           (via sub_1dbd, entry SP 0x6bea-0x6bee, all inside STACK_SCRATCH) + a
 *           crafted entry whose SP points into ordinary work RAM (return bytes in the
 *           COMPARED region) to prove the ret's pop is READ-ONLY there too. Compared
 *           on RAM-STACK_SCRATCH + pc + SP; the harness supplies the matching ret so
 *           pc/SP line up. Teeth: a stray-memory-write twin and an extra-stack-pop
 *           twin, both caught.
 * LIVE-OUT: memory-only — and there is none. The routine writes no memory, and its
 *           caller (sub_1dbd -> loc_197a @0x197D) reads no register/flag on return
 *           (it proceeds straight to the next call in the cascade), so there is no
 *           live register or flag out. The oracle's residual A/flags are dead ABI.
 * NAMES:    none — references no RAM address. 0x6340 (the dispatcher's state byte,
 *           unnamed engine scratch) is named only in this prose; not touched here.
 */
export function loc_1e49(_m) {
  // A no-op: the Z80 `ret` becomes the JS return. No stack pop, no pc/SP bookkeeping,
  // no memory touched. sub_1dbd's dispatch on 0x6340 == 0 lands here and does nothing.
  // The machine argument is accepted (this is a machine routine by signature) but
  // deliberately unused.
}
