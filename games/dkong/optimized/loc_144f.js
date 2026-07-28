// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_144f — hand-optimized rewrite of the translated routine at ROM 0x144F,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its single tail (0x1459 = loc_1459, reached by FALLING
 * THROUGH — the two routines are contiguous in ROM) is invoked through `m.call`,
 * the routine registry (games/dkong/routines.js), so it resolves to the oracle or
 * to loc_1459's own optimized rewrite — never a copied implementation here. Only
 * the RAM *name* CURRENT_PLAYER (0x600D) is imported from ram.js; the sibling byte
 * 0x600E stays hex (see NAMES).
 */

import { CURRENT_PLAYER } from "./ram.js";

/**
 * loc_144f -- loc_141e's "record == 3 found" tail: mark player 2 up, then fall
 * into loc_1459.  [ROM 0x144F-0x1458, then FALLS THROUGH into loc_1459 @ 0x1459]
 *
 *   144f  3e 01        ld   a,0x01
 *   1451  32 0e 60     ld   (0x600e),a   ; player index = 1
 *   1454  32 0d 60     ld   (0x600d),a   ; CURRENT_PLAYER = 1  (player 2 up)
 *   1457  3e 00        ld   a,0x00       ; A = 0 for loc_1459 (record==1 path uses A=1)
 *   1459  ...          (falls through into loc_1459 -- NO jump; contiguous)
 *
 * WHAT IT DOES.  Reached from loc_141e (entry idx20 of the 0x0702 game-state
 * dispatch, GAME_SUBSTATE == 0x14) when its 0x611C[5] scan finds NO record == 1
 * but a record == 3. It marks player 2 as the up player -- player index (0x600E)
 * := 1 and CURRENT_PLAYER (0x600D) := 1 -- then loads A = 0 and FALLS THROUGH into
 * loc_1459 (there is no jump: 0x1457 `ld a,0x00` runs straight into 0x1459).
 *
 * The A handed to loc_1459 is the whole point of the fall-through: loc_1459 opens
 * with `A |= (0x6026)` before writing the flip-screen latch (0x7D82). The record==1
 * path enters loc_1459 with A = 0x01 (the search key), forcing bit 0 of that latch;
 * this record==3 path enters with A = 0x00, so the latch takes (0x6026) unmodified.
 *
 * INPUTS  : none read here (it writes two constants and sets A).
 * OUTPUTS : RAM 0x600E := 1 and CURRENT_PLAYER (0x600D) := 1; register A := 0; then
 *           loc_1459's effects. Register file at the fall-through: A = 0, and
 *           B/C/D/E/H/L/F carried UNCHANGED from entry (loc_144f runs only `ld`
 *           instructions, none of which touch a flag or any other register). PC =
 *           0x1459 at the tail m.call. No boolean is returned; loc_1459's return
 *           value (undefined) is forwarded for hygiene, matching the oracle.
 *
 * NAMES.  0x600D is CURRENT_PLAYER (ram.js: 0 = P1 / non-zero = P2, control-proven),
 *   imported. 0x600E is left HEX: ram.js keeps it as unnamed scratch (SCRATCH_600e).
 *   loc_141e clears it to 0 before its scan and calls it the "player index", and
 *   loc_144f sets it to 1 on this player-2 path -- but it has no control-poke
 *   evidence of its own, so naming it here would be correlation, not control
 *   (README §4). Reported only as a weak candidate, not asserted.
 *
 * FLAGS.  loc_144f executes only `ld` instructions, which leave every flag (and the
 *   undocumented F3/F5 bits) untouched. There is nothing to preserve or drop: F on
 *   the fall-through equals F on entry, automatically. Plain `regs.a = ...`
 *   assignments (not flag-setting ops) reproduce this exactly; the unit gate
 *   compares the whole register file including F.
 *
 * ATOMIC / CYCLES -- COLLAPSED to a SINGLE m.step for the whole routine. loc_144f is
 *   one straight-line basic block with NO branch: ld a[7] + ld (0x600e),a[13] +
 *   ld (0x600d),a[13] + ld a[7] = 40t, exit PC 0x1459. It is reached ONLY from
 *   loc_141e, which runs INSIDE the vblank NMI (handler clears the NMI mask on entry,
 *   so it is non-reentrant); no nested NMI can land inside loc_144f OR the loc_1459
 *   it falls into, so the routine is ATOMIC and its internal cycle DISTRIBUTION is
 *   unobservable. The TOTAL is still load-bearing (it is part of the NMI handler's
 *   cost, which sets the main-loop spin count that seeds the PRNG, README §2), so the
 *   40t total is preserved EXACTLY. No hardware (0x7Dxx) write occurs here -- both
 *   stores are work RAM -- so there is no bus-cycle boundary to pin and no --writes
 *   trace at stake (the flip-screen 0x7D82 write lives in loc_1459, which runs
 *   unchanged via m.call). Because loc_144f is atomic and this collapse is byte-exact,
 *   the STRICT whole-machine gate proves it (like its parent loc_141e); the convergent
 *   gate -- which only LICENSES an interruptible collapse's transient raster tear /
 *   dead-stack PC -- is neither needed nor used (docs/decompiler-pipeline).
 *
 * The fall-through into loc_1459 is a TAIL transfer with NO push16: loc_1459's own
 * `ret` returns to loc_144f's caller (ultimately loc_141e's caller's caller, since
 * loc_141e tail-jumped here). loc_1459 is reached via `m.call(0x1459)` so it resolves
 * to the oracle or to its own optimized rewrite; `return` forwards its (inert) answer.
 */
export function loc_144f(m) {
  const { regs, mem } = m;

  // Mark player 2 as the up player, then hand loc_1459 A = 0.
  mem.write8(0x600e, 0x01); // player index := 1 (unnamed scratch; see NAMES)
  mem.write8(CURRENT_PLAYER, 0x01); // CURRENT_PLAYER (0x600D) := 1 -> player 2 up
  regs.a = 0x00; // A = 0 for loc_1459 (the record==1 path passes A = 1)

  // One collapsed charge: ld a,1[7] + ld(0x600e),a[13] + ld(0x600d),a[13] + ld a,0[7]
  // = 40t, exit PC 0x1459 (atomic routine; total preserved, distribution unobservable).
  m.step(0x1459, 40);

  // Fall through into loc_1459 (contiguous in ROM) -- a TAIL transfer, NO push16, so
  // loc_1459's ret returns to OUR caller. `return` forwards its (inert) result.
  return m.call(0x1459);
}
