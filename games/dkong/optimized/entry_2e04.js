// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_2e04 — hand-optimized rewrite of the translated routine at ROM 0x2E04,
 * proven equal to its oracle by the equivalence harness.
 *
 * A short PROLOGUE + a 10-iteration DJNZ LOOP. Two `rst` skip-gates guard the loop;
 * once past them it walks a 10-record object table (IX = 0x6500, stride 0x10),
 * updating each object and mirroring the result into its sprite record
 * (IY = 0x6980, stride 0x04) via the per-object body obj_2e12. Both rst gates and the
 * loop body are dispatched through `m.call` (the routine registry, games/dkong/routines.js),
 * so they resolve to the oracle or their own optimized rewrites — never inlined here.
 *
 * No RAM name is imported: the two address literals, 0x6500 and 0x6980, are
 * SCRATCH_6500 / SCRATCH_6980 footprint placeholders in ram.js. Matching sub_2a22's
 * convention for the same kind of placeholder base, they are kept hex with a comment
 * rather than dressed in a placeholder name. See the naming candidates reported with
 * this rewrite (strongly corroborated by sub_1186 / sub_28e0 / sub_30bd).
 */

/**
 * entry_2e04 -- per-object actor/animation updater over the 10-record 0x6500 table.
 * [ROM 0x2E04-0x2E83]
 *
 *   2e04  3e 04        ld   a,0x04        ; gate selector: bit index 2
 *   2e06  f7           rst  0x30          ; sub_0030 -- BOARD gate (skip-capable)
 *   2e07  d7           rst  0x10          ; sub_0010 -- ENABLE gate (skip-capable)
 *   2e08  dd 21 00 65  ld   ix,0x6500     ; object/actor table base (SCRATCH_6500)
 *   2e0c  fd 21 80 69  ld   iy,0x6980     ; sprite-mirror table base (SCRATCH_6980)
 *   2e10  06 0a        ld   b,0x0a        ; 10 objects
 *   2e12  ...          (obj body 0x2E12) ; process one object; ends at loc_2e78
 *   2e81  10 ??        djnz 0x2e12        ; next object
 *   2e83  c9           ret
 *
 * WHAT IT DOES. A = 0x04 is the bit-index argument both rst gates test.
 *   - rst 0x30 (sub_0030) rotates A right B times where B = (0x6227) (the BOARD byte)
 *     and returns NORMALLY only if the resulting carry is set -- i.e. it selects bit
 *     (B-1) of 0x04. Since only bit 2 of 0x04 is set, it passes only when the board
 *     makes carry land on bit 2 (measured: board == 3). Otherwise it SPLICES past
 *     entry_2e04 and returns false.
 *   - rst 0x10 (sub_0010) returns NORMALLY only if bit 0 of (0x6200) is set, else it
 *     SPLICES and returns false.
 * Past both gates it presets IX/IY/B and runs the object loop: for each of the 10
 * records obj_2e12 (0x2E12) tests the active bit, does the every-16-frame animation
 * toggle, advances position / walks the 0x39xx animation string, and mirrors position
 * into the sprite record; loc_2e78 (its tail) advances IX by 0x10 and IY by 0x04.
 *
 * THE rst SKIP CONTRACT (identical to entry_30ed's guards). Each gate is written
 * `if (!m.call(0xADDR)) return;`. On a splice the callee has ALREADY unwound past
 * entry_2e04 to entry_2e04's OWN caller (its `pop`/`inc sp`+`ret` discarded the rst
 * return address AND popped entry_2e04's caller-return), and it signals this by
 * returning false. The JS body then just falls out with a BARE `return` -- it must NOT
 * run its own `m.ret()`, which would pop a second frame. On the normal path the
 * boolean is true, PC is back inside entry_2e04, and the loop runs.
 *
 * INPUTS  : A is set here (0x04). The gates read 0x6227 (board) and 0x6200 (enable);
 *           the loop reads/writes the 10 records at 0x6500 (stride 0x10) and their
 *           sprite mirrors at 0x6980 (stride 0x04), plus 0x601a (the 16-frame tick),
 *           the 0x39xx animation strings, and 0x6083/0x6084/0x6396 via obj_2e12's
 *           chain. The stack carries entry_2e04's caller-return, which the two splice
 *           paths consume.
 * OUTPUTS : whatever the gates + the 10 obj_2e12 passes leave (the object + sprite
 *           tables, registers, flags). entry_2e04 itself returns void; on a splice PC
 *           is already at its caller, on the full path `m.ret()` returns there.
 *
 * FLAGS -- nothing in entry_2e04's own body reads a flag. `ld a` / `ld ix` / `ld iy` /
 * `ld b` are flag-neutral; `djnz` affects NO flags (that is why regs.djnz() is used, not
 * dec8). The gates and obj_2e12 set A/F themselves and the registry call reproduces them
 * exactly; the unit gate compares the whole register file incl. F. So there is no flag
 * to keep or drop here.
 *
 * CYCLES -- ONE partial collapse, on the full-loop path only:
 *   - `ld a,0x04` is a single instruction before the first gate boundary; kept as its
 *     own m.step (7 t at 0x2E06).
 *   - Both rst gates are m.call BOUNDARIES and are NOT folded across: push16 (the rst
 *     return address) + m.step(vector, 11 t) + m.call stay verbatim, exactly as the
 *     oracle. Nothing is folded between them (they are back-to-back).
 *   - The three setup `ld` (ld ix [14] + ld iy [14] + ld b [7]) form ONE basic block
 *     with no hardware-latch write and no call between them; COLLAPSED to a single
 *     m.step at the block-exit PC 0x2E12 = 35 t (the exact oracle sum). This is the
 *     only redistribution, and it is reached only on the full-loop arm.
 *   - The DJNZ loop keeps the oracle's PER-ITERATION charge verbatim: obj_2e12 (its own
 *     internal cycles) then one m.step for the djnz -- 13 t taken (back to 0x2E12) / 8 t
 *     fall-through (to 0x2E83). B = 10, so the loop charges 9 taken (13 t) + 1
 *     fall-through (8 t) = 125 t of djnz overhead around the 10 object bodies.
 *   - `ret` = 10 t (m.ret).
 * Per-arm oracle totals (crafted seed, RET frame only; measured): gate1-skip 84 t,
 * gate2-skip 159 t, full-loop 1383 t. The collapse preserves the full-loop total
 * exactly, so the main-loop spin count 0x6019 (the PRNG entropy) is unchanged. No
 * hardware-latch write occurs anywhere in this routine's own body, so no bus-cycle
 * boundary is pinned here.
 *
 * REACHABILITY / GATE (MEASURED). Dispatched from loc_197a's per-frame NMI cascade.
 * Probed over 1400 attract frames: entry_2e04 fires 816x (first ~frame 586, once the
 * demo starts PLAYING 25m). It is ATOMIC -- every one of the 816 dispatches occurs
 * INSIDE the NMI handler (io.nmiMask == 0 at 816/816; outside-NMI 0), where entry_0066
 * cleared the NMI mask so the interrupt cannot re-enter, and the NMI's pushed PC NEVER
 * lands in [0x2E04,0x2E83] (0 landings over 1394 NMIs; all fall in the 0x02xx/0x03xx
 * main-loop band + the rst tail). An atomic routine whose naturally-reached arm keeps
 * the oracle's exact cycle distribution passes the STRICT byte-exact whole-machine gate
 * directly, so that is the gate used.
 *
 * BUT the natural attract arm is ALWAYS gate1-skip: board (0x6227) == 1 at 816/816
 * dispatches, so rst 0x30 (needing board == 3) always splices -- the loop and its
 * collapse are NEVER exercised in attract. So the STRICT whole-machine gate proves the
 * gate1-skip arm byte-exact (816x, non-vacuous), and the two board-3-gated arms
 * (gate2-skip, full-loop) -- exactly like sub_2a22's board-gated collapse -- are proven
 * from crafted identical-both-sides pokes (doc 06 pattern 3: poke 0x6227 = 3, 0x6200
 * bit0) that steer the game's OWN gates, with each arm's EXACT oracle cycle total pinned
 * DIRECTLY (the teeth for the fold: a dropped 35->30 charge is CAUGHT). See
 * equivalence-2e04.test.js.
 */
export function entry_2e04(m) {
  const { regs } = m;

  // 2E04  ld a,0x04 -- the bit-index (bit 2) both rst gates test. Single instruction
  // before the first gate boundary; kept as its own step (7 t).
  regs.a = 0x04;
  m.step(0x2e06, 7);

  // 2E06  rst 0x30 (sub_0030) -- BOARD gate. On a splice it unwound past us: bail.
  m.push16(0x2e07);
  m.step(0x0030, 11);
  if (!m.call(0x0030)) return;

  // 2E07  rst 0x10 (sub_0010) -- ENABLE gate. Same skip contract.
  m.push16(0x2e08);
  m.step(0x0010, 11);
  if (!m.call(0x0010)) return;

  // 2E08 ld ix,0x6500 [14] + 2E0C ld iy,0x6980 [14] + 2E10 ld b,0x0a [7] -- one basic
  // block, no hw-write / no call between; COLLAPSED to 35 t at the exit PC 0x2E12.
  regs.ix = 0x6500; // object/actor table base (10 records, stride 0x10) -- ram.js SCRATCH_6500
  regs.iy = 0x6980; // sprite-mirror table base (10 records, stride 0x04) -- ram.js SCRATCH_6980
  regs.b = 0x0a; // 10 objects
  m.step(0x2e12, 35);

  // 2E12..2E82  djnz loop -- process each of the 10 objects, then loop back to 0x2E12.
  do {
    m.call(0x2e12); // obj_2e12 -- one object; its tail loc_2e78 advances IX by 0x10, IY by 0x04
    regs.djnz(); // dec B, sets no flags
    m.step(regs.b !== 0 ? 0x2e12 : 0x2e83, regs.b !== 0 ? 13 : 8); // djnz: 13 t taken / 8 t fall-through
  } while (regs.b !== 0);

  // 2E83  ret (10 t) -- back to entry_2e04's caller.
  m.ret();
}
