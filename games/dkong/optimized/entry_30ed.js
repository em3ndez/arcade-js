// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_30ed — hand-optimized rewrite of the translated routine at ROM 0x30ED,
 * proven equal to its oracle by the equivalence harness. It is a pure
 * ORCHESTRATOR: four sequenced `call`s and a `ret`, with no arithmetic, no flags,
 * and no work-RAM access of its own (only the stack pushes the CALLs model). So it
 * imports no name from ram.js — there is nothing here to name.
 */

/**
 * entry_30ed -- run the four-stage >=0x3000 object-processing chain, then return.
 * [ROM 0x30ED-0x30F9]
 *
 *   30ed  cd fa 30     call 0x30fa   ; SKIP-CAPABLE guard #1 (rst-28 tail dispatch)
 *   30f0  cd 3c 31     call 0x313c   ; SKIP-CAPABLE guard #2 (inc-sp splice)
 *   30f3  cd b1 31     call 0x31b1   ; plain call (object walk)
 *   30f6  cd f3 34     call 0x34f3   ; plain call (scatter-gather)
 *   30f9  c9           ret           ; back to entry_30ed's caller
 *
 * WHAT IT DOES. entry_30ed is the HEAD of the >=0x3000 closure chain
 * (30ed -> 31b1 -> 3202 -> 333d ...). It sequences four sub-passes over the object
 * tables and returns. Two of the four are CALLER-SKIP guards, and the other two
 * are ordinary calls:
 *
 *   - call 0x30fa (sub_30fa) -- clamps 0x6380 to [0,5] and `rst 0x28` TAIL-dispatches
 *     to one of the four 0x3110-family guards. Because the rst is sub_30fa's last
 *     instruction, the guard returns straight to entry_30ed's frame, and sub_30fa
 *     passes the guard's skip-boolean up TRANSPARENTLY. If that guard SPLICES
 *     (inc sp/inc sp/ret), it unwinds PAST entry_30ed to entry_30ed's OWN caller and
 *     the boolean is `false`; entry_30ed must then abandon the rest of the chain.
 *   - call 0x313c (entry_313c) -- counts the non-empty objects at 0x6400; if the
 *     count is ZERO it SPLICES (inc sp/inc sp/ret at 0x3179), discarding entry_30ed's
 *     0x30F3 return and returning to entry_30ed's caller -> boolean `false`.
 *   - call 0x31b1 (entry_31b1) -- walks 5 objects, dispatching entry_3202 per
 *     non-empty one. Returns NORMALLY (no splice, no boolean).
 *   - call 0x34f3 (entry_34f3) -- scatter-gathers 4 bytes per non-empty object into
 *     the 0x69D0 record table. Returns NORMALLY.
 *
 * THE CALLER-SKIP IDIOM. Each guard is written `if (!m.call(0xADDR)) return;`. On
 * the splice, the callee has ALREADY unwound past entry_30ed (its `ret` popped
 * entry_30ed's caller-return address and set PC there), so the JS body just falls
 * out with a plain `return` -- it must NOT do its own `m.ret()`, which would pop a
 * second frame. On the normal path the boolean is `true`, PC is back inside
 * entry_30ed, and the chain continues. All four callees are dispatched through the
 * registry (`m.call`), so they resolve to the oracle or their own optimized
 * rewrites; this routine never inlines them.
 *
 * INPUTS  : none in registers/flags. The chain reads the object tables at 0x6400
 *           (stride 0x20) and the guard inputs 0x6380 / 0x601a via its callees; the
 *           stack carries entry_30ed's caller-return address, which the two splice
 *           paths consume. entry_30ed itself reads/writes no work RAM directly.
 * OUTPUTS : whatever the four callees leave (registers, flags, and the object/record
 *           tables). entry_30ed contributes only the four CALL stack pushes and its
 *           final RET. It returns void: on a splice, PC is already at its caller
 *           (the callee unwound), and on the full path `m.ret()` returns there. Its
 *           own caller does NOT branch on a return value (entry_30ed is not itself
 *           boolean-guarded).
 *
 * FLAGS -- NONE to reason about: entry_30ed executes only `call`/`ret`, which touch
 * no flags. The observable exit F is simply whatever the last callee left; entry_30ed
 * neither reads nor writes a flag, so there is nothing to keep or drop here.
 *
 * CYCLES -- NO collapse is possible OR needed. Every instruction in entry_30ed is a
 * control transfer (four `call`s + one `ret`), so there is no straight-line run of
 * instructions to fold into a single m.step -- each instruction is already its own
 * cycle boundary. The per-instruction charges are therefore kept EXACTLY as the
 * oracle: 17 t per `call` (charged at the call target immediately before m.call), and
 * 10 t for the `ret` (m.ret). This makes every arm's total byte-identical to the
 * oracle by construction, so the frame's cycle budget -- hence the main-loop spin
 * count 0x6019 (the PRNG entropy) -- is unchanged. (Folding across a `call` is
 * forbidden anyway: the callee runs between the charge and the next instruction.)
 *
 * The four CALL pushes land in WORK RAM near the 0x6BFF stack top -- NOT a tagged
 * hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87) -- so no
 * hardware bus cycle is hidden here and there is no write-trace test to add.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- the oracle docstring's "not yet wired /
 * reachable only when handler_1977 lands" note is STALE). loc_197a's per-frame update
 * cascade now dispatches entry_30ed from the NMI game-state gameplay path. Probed over
 * 1400 attract frames: entry_30ed is dispatched 816x (first entry ~frame 586, once the
 * attract demo starts PLAYING 25m), so a whole-machine run exercises it and the strict
 * gate is NON-vacuous. All three reachable arms occur NATURALLY in that run -- guard-1
 * skip 408x, guard-2 skip 142x, full four-call cascade 266x -- so every branch is
 * exercised by the real cascade, not just synthesis.
 *
 * It is ATOMIC: every one of the 816 dispatches occurs INSIDE the NMI handler
 * (io.nmiMask == 0 at 816/816 entries; outside-NMI 0), where entry_0066 has cleared
 * the NMI mask so the interrupt cannot re-enter -- and correspondingly the NMI's
 * pushed PC NEVER lands in [0x30ED,0x30F9] (0 landings over 1394 NMIs; nor anywhere in
 * the 0x3000-0x34FF chain; all landings fall in the 0x02BD-0x0372 main-loop band). An
 * atomic routine that ALSO keeps the oracle's exact per-instruction cycle distribution
 * pushes no mistimed PC and tears no raster, so it passes the BYTE-EXACT (STRICT)
 * whole-machine gate directly and does NOT need the convergent gate. See
 * equivalence-30ed.test.js.
 */
export function entry_30ed(m) {
  // A Z80 `call TARGET` (opcode 0xCD, 3 bytes, 17 T-states): push the address of
  // the NEXT instruction as the return address, charge the call, then dispatch the
  // callee through the registry. The return value is the callee's CALLER-SKIP
  // boolean -- meaningful only for the two skip-capable guards (false == the callee
  // spliced past entry_30ed to its caller); ignored for the two plain calls.
  const call = (returnAddr, target) => {
    m.push16(returnAddr);  // return address = next instruction after this call
    m.step(target, 17);    // `call` = 17 T, charged at the target before dispatch
    return m.call(target); // registry -> oracle or optimized
  };

  // 30ED  call 0x30fa -- guard #1. On a splice it unwound past us: abandon the chain.
  if (!call(0x30f0, 0x30fa)) return;

  // 30F0  call 0x313c -- guard #2 (zero non-empty objects splices): same skip contract.
  if (!call(0x30f3, 0x313c)) return;

  // 30F3  call 0x31b1 -- object walk; returns normally.
  call(0x30f6, 0x31b1);

  // 30F6  call 0x34f3 -- scatter-gather; returns normally.
  call(0x30f9, 0x34f3);

  // 30F9  ret -- normal return to entry_30ed's caller (10 T).
  m.ret();
}
