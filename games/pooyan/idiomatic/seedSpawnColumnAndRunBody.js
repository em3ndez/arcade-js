// SPDX-License-Identifier: GPL-3.0-only
import { loc_5733 } from "./loc_5733.js";
/**
 * seedSpawnColumnAndRunBody — spawn one enemy into an already-chosen actor slot.
 *
 * WHAT IT IS
 *   A two-instruction entry wrapper sitting in front of the shared spawn body. A caller that has
 *   already located an empty actor record and just wants it filled arrives here. The wrapper plants
 *   the single value the body needs but that its other entry points supply differently — the
 *   entry-column seed 0xff — and then runs the body. It has no arithmetic or state of its own
 *   beyond that one seed.
 *
 * ROLE IN THE MACHINE
 *   A new enemy is born by claiming a free actor record and stamping a fresh actor into it. The
 *   spawn body performs all of that stamping; this wrapper is the doorway used by the scripted
 *   lane-spawn path, which picks the record itself and hands it in. The 0xff seeded here is the
 *   body's entry column: the body stashes the value, and after it has computed this enemy's real
 *   spawn column from the difficulty / round / gauge state, it feeds the original 0xff to the
 *   start-of-scan state machine as a countdown seed. 0xff is the maximal value, so that countdown
 *   runs its full span before the scan branch changes.
 *
 *   The two inputs pass straight through to the body: IX addresses the actor record to fill, and E
 *   carries the enemy kind byte that lands in the record's kind field at +0x04. The caller chooses
 *   both — IX by walking the record pool, E from the round parity.
 *
 * ROM 0x53a0 (0x53a0-0x53a5).
 * Grounding: [seen].
 *
 * SEATING: caller-skip. The spawn body finishes by dropping one stack level and returning above the
 * routine that invoked it. When it runs from here that return lands in this wrapper's own caller and
 * bypasses the wrapper's trailing return entirely, which is therefore dead code. The wrapper thus
 * contributes only the seed and carries no epilogue: there is nothing left to do once the body runs.
 *
 * LIVE-OUT: memory only. Everything durable is written by the spawn body — the initialised actor
 * record at IX, the reloaded spawn-cadence timer (ENEMY_SPAWN_TIMER 0x8d07), and the bumped
 * live-enemy tally (ACTIVE_ENEMY_COUNT 0x8d40). The wrapper itself leaves nothing behind, in memory
 * or in any register.
 */
const SEED = 0xff; // entry-column seed handed to the spawn body — ROM 0x53a0 `ld c,0xff` (the maximal countdown value the start-of-scan state machine reads back)

export function seedSpawnColumnAndRunBody(m, ix = m.regs.ix, e = m.regs.e) {
  // Run the shared spawn body on the chosen record (IX) for the chosen kind (E), with its entry
  // column seeded to 0xff. This is the `call 0x5733` at ROM 0x53a2. The body stamps the record's
  // opening state/timer/flag fields, folds the difficulty setting, round number and phase-gauge
  // state into a single spawn column, uses that column to arm the enemy's motion increment, its
  // animation sequence and the next spawn-cadence reload, bumps the live-enemy count, and enters
  // the start-of-scan state machine on the seeded entry column — then skip-returns past this
  // wrapper into the caller above (the wrapper's own return at ROM 0x53a5 never executes).
  loc_5733(m, SEED, ix, e);
}
