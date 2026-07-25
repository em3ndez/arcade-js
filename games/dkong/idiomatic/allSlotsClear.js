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
 *           The oracle's residual A/B/HL/flags are dead ABI — the sole caller overwrites
 *           A and HL before reading them, and the grandparent reads neither.
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
