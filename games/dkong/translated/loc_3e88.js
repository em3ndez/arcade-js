// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3e88  (ROM 0x3E88–0x3E98) — 5 code bytes + 12 inline-table bytes.
 *
 *   3e88  3a 27 62    ld   a,(0x6227)
 *  3e8b e5 push hl ; handed to the dispatch target
 *   3e8c  ef          rst  0x28              ; TAIL dispatch through the table below
 *   ; table 0x3E8D-0x3E98:  0x0000  0x3E99  0x28B0  0x28E0  0x2901  0x0000
 *
 * the 12-byte table is read from ROM by sub_0028, not
 * transcribed.
 * Not yet wired into the live dispatcher: called only from 0x286B (< 0x3000,
 * untranslated); nothing in translated src invokes loc_3e88, and its four
 * dispatch targets are reached ONLY through THIS table -- never through the
 * executed NMI (0x00CA) / substate (0x0748) / sub_30fa (0x3104) dispatches
 * (grep-confirmed). Wiring the four targets into dispatchGameState (nmi.js)
 * becomes relevant only once handler_1977 lands and this chain actually runs.
 *
 * THE PUSH/POP-ACROSS-DISPATCH SHAPE (why this is NOT the sub_30fa tail case,
 * even though both end in rst 0x28). loc_3e88 does `push hl` BEFORE the rst
 * precisely because sub_0028 clobbers HL (its own `pop hl` takes the table base
 * 0x3E8D into HL). The pushed HL sits BELOW that on the stack; the target
 * (entry_3e99, table entry 1) recovers it with its first instruction, `pop hl`,
 * and passes H/L down to entry_3ec3 as collision bounds. So the push is a
 * live-in hand-off across the dispatch boundary, not decorative.
 *
 * STILL A TAIL DISPATCH for frame accounting: the rst is loc_3e88's LAST
 * instruction (0x3E8D+ is table DATA), so loc_3e88 has no frame of its own when
 * the target rets -- the target returns straight to loc_3e88's caller.
 * `return sub_0028(...)` therefore passes the target's value up transparently, and
 * the extra pushed HL is balanced by the target's `pop hl`.
 *
 * THE STACK-BALANCE CROSS-REGION INVARIANT.
 * The table's non-null targets are entry_3e99 (mine) and 0x28B0/0x28E0/0x2901
 *  (< 0x3000). entry_3e99 pops the pushed HL; whether the three
 * targets also pop is THEIR units' business. A target that does not pop leaves
 * the stack unbalanced across the dispatch. Inert today; load-bearing
 * when 0x1977 lands. Two `dw 0x0000` guards (indices 0 and 5) are the
 * reset-vector null guard for an out-of-range 0x6227 (its writers' business).
 * `rst 0x28` is precedented (sub_0028), applied with table base 0x3E8D, not
 * re-derived. 0x6227 not interpreted.
 */
export function loc_3e88(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6227);
  m.step(0x3e8b, 13); // ld a,(0x6227)
  m.push16(regs.hl); // push hl -- handed to the dispatch target through the stack
  m.step(0x3e8c, 11); // push hl

  // rst 0x28 -- TAIL dispatch through the inline table at 0x3E8D. rst pushes the
  // table base (0x3E8D); sub_0028 pops it, indexes table[A] from ROM, dispatches,
  // and returns the target's value, which we pass straight up.
  m.push16(0x3e8d);
  m.step(0x0028, 11); // rst 0x28
  return m.call(0x0028, "0x3E8D (loc_3e88 dispatch)");
}
