// SPDX-License-Identifier: GPL-3.0-only
/**
 * allSlotsClear — is a strided table of ten object slots fully cleared?  ROM 0x1783.
 *
 * The sole caller (sub_1757) needs to know whether a group of ten object slots has
 * been fully emptied before it arms the next phase. This routine walks that group:
 * ten cells starting at `base`, stepping `stride` bytes each time (the Z80 HL/DE the
 * caller sets up), and reports whether every one of the ten bytes is zero. In its one
 * caller the table is the 10-record sprite-object block (SPRITE_OBJ_BLOCK 0x6908,
 * 4-byte records — so base = 0x6908, stride = 4): it answers "are all ten object
 * sprites cleared?". Only the count (ten) is hard-wired; the base and stride are the
 * caller's, so it is a generic ten-cell strided all-zero predicate.
 *
 * It short-circuits at the first non-zero cell ("that slot is still occupied") and
 * returns false. In the oracle that non-zero exit is a `jp 0x0026` CALLER-SKIP: it
 * pops its own return address and rets straight to the grandparent, aborting the
 * caller mid-flow — the classic caller-skip idiom, expressed here as `return false`
 * (doc-06: caller-skip -> boolean return; the caller uses `if (!allSlotsClear(...)) return;`).
 * All ten zero returns true and the caller proceeds (arms 0x6009, advances 0x6388).
 * A READ-ONLY LEAF: reads the ten cells, writes no memory, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1783.test.js.
 * GATE:     crafted-entry — not reached in plain attract (0/6000 frames), so validated
 *           on crafted strided-scan states covering every arm (first/middle/last-slot
 *           occupied, all-clear, several strides) plus a randomized differential sweep
 *           vs the oracle. TEETH: a 9-instead-of-10 twin, caught by the last-slot arm.
 * LIVE-OUT: memory-only — writes nothing; the caller-skip decision is the boolean
 *           return (true = all clear, caller continues; false = a slot occupied, abort).
 *           The oracle's residual A/B/HL/flags are dead ABI to the PURE function — the
 *           sole caller overwrites A and HL before reading them, and the grandparent reads
 *           neither. The wired address takes HL/DE as its base/stride and does reproduce
 *           the all-clear arm's register file exactly (its carry escapes loc_1757's
 *           `inc (hl)`); see the seam entry below.
 * NAMES:    none in-body — a pointer walk over the caller-supplied base/stride, references
 *           no fixed RAM address. (Its one caller drives it over SPRITE_OBJ_BLOCK 0x6908.)
 */
export function allSlotsClear(mem, base, stride) {
  let addr = base & 0xffff;
  for (let slot = 0; slot < 10; slot++) {
    if (mem.read8(addr) !== 0) return false; // an occupied slot -> not clear (caller-skip)
    addr = (addr + stride) & 0xffff; // advance to the next slot (Z80 `add hl,de`, 16-bit wrap)
  }
  return true; // all ten slots empty
}

/**
 * The SEAM ENTRY for ROM 0x1783 — `ROUTINES[0x1783].entry`, the export the override
 * resolvers wire. The seam dispatches an override as `fn(m)`; the predicate above keeps
 * its `(mem, base, stride)` shape for direct idiomatic callers and for its gate.
 *
 * ABI, read off the frozen oracle (translated/loc_1783.js, ROM 0x1783-0x178D):
 *
 *     1783  06 0a      ld b,0x0a       ; the COUNT is hard-wired, not passed
 *     1785  7e         ld a,(hl)       ; <- HL is the base, live-in
 *     1786  a7         and a
 *     1787  c2 26 00   jp nz,0x0026    ; occupied -> caller-skip via `pop hl / ret`
 *     178a  19         add hl,de       ; <- DE is the stride, live-in
 *     178b  10 f8      djnz 0x1785
 *     178d  c9         ret
 *
 *   IN:   HL = the table base, DE = the stride. (The count is the ROM's own 0x0A.)
 *   OUT:  the CALLER-SKIP verdict, as the boolean `m.call` forwards — true = all ten
 *         clear, caller continues; false = a slot is occupied, abort. 0x1783 is in
 *         machine.js's SEAM_CALLER_SKIP, so the `false` also consumes the second stack
 *         word the oracle's `jp 0x0026` (`pop hl / ret`) discards.
 *   MEM:  nothing — read-only.
 *
 * THE TWO ARMS ARE NOT EQUALLY RECOVERABLE, and the wrapper treats them differently on
 * purpose.
 *
 *   ALL CLEAR — REGISTER-EXACT, and free. The walk's endpoint is fixed by the arm itself:
 *     the tenth cell it read was zero, so A = 0; `djnz` ran the count out, so B = 0; and
 *     HL advanced by the stride exactly ten times. Replaying the last two flag-setting
 *     instructions (`and a` on that zero, then the tenth `add hl,de`, which overwrites
 *     H/N/C while `add hl,rr` preserves S/Z/PV) reproduces F as well. This is the arm that
 *     MATTERS: control continues in loc_1757, whose `inc (hl)` at 0x176B PRESERVES CARRY
 *     and then rets — so a carry left over from before the call really does escape the
 *     subtree. Measured: without this replay the flag byte differs at loc_1757's exit.
 *
 *   OCCUPIED (the caller-skip) — the residuals are DROPPED. Where the walk stopped is not
 *     recoverable from a boolean, and rebuilding it would mean re-walking the table inside
 *     the wrapper that exists to marshal into the predicate. So A = the stopping byte,
 *     B = the remaining count, HL = the stopping address and F are dropped. Control here
 *     does not continue in loc_1757 at all: the oracle's `jp 0x0026` discards loc_1783's
 *     return and rets past its caller into the rst-0x28 dispatcher's continuation.
 *     ★ HONEST LIMIT: 0x1783 is dispatched ZERO times in 12000 attract frames, so no
 *     whole-machine gate exercises this arm — the drop rests on source reading alone, not
 *     on a measurement. The two-level test in idiomatic/test/seam-entry-abi.test.js is its
 *     only live coverage.
 */
export function allSlotsClearFromRegisters(m) {
  const { regs, mem } = m;
  const base = regs.hl;
  const stride = regs.de;

  if (!allSlotsClear(mem, base, stride)) return false; // caller-skip; residuals dropped, see above

  // The all-clear exit's register file, replayed from the oracle's last pass.
  regs.a = 0x00; // 0x1785 `ld a,(hl)` — the tenth cell, zero on this arm by definition
  regs.and(regs.a); // 0x1786 `and a` — Z set, S clear, PV even, carry cleared
  regs.hl = (base + 9 * stride) & 0xffff; // the first nine `add hl,de`
  regs.addHl(stride); // 0x178A the tenth — rewrites H/N/C, keeps the S/Z/PV above
  regs.b = 0x00; // 0x178B `djnz` ran the count out; it sets no flags
  return true;
}
