// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchElevatorRideByColumn — while Mario is standing on a 75m elevator, route him to the
 * up-column or the down-column carry by his X.  ROM 0x2745.
 *
 * Runs only when Mario is aboard a lift and grounded; two guards drop the whole
 * routine otherwise:
 *   - EDGE_REPOSITION_FLAG clear — he is not on a lift this frame, so it returns.
 *   - MARIO_AIRBORNE set — busy in the air, so it leaves the carry for a grounded
 *     frame and returns.
 *
 * With both guards open it reads MARIO_X and routes by X band, one band per lift column:
 * [0x2C, 0x43) is the RISING column and runs carryMarioUpWithLift, [0x6C, 0x83) is the
 * DESCENDING column and runs carryMarioDownWithLift. Each steps Mario's Y one pixel with
 * the lift and mirrors it to his sprite record; each hands off to
 * killMarioAtEndOfLiftTravel, which zeroes MARIO_ACTIVE — a kill, not an end-of-travel
 * reset — once MARIO_Y crosses that arm's own absolute row limit (0x71 going up, 0xE8
 * going down). Those limits are rows, read with no reference to the lift's own travel.
 * Every X outside both bands runs loc_2766. Nothing is written here directly;
 * every effect is the dispatched arm's.
 *
 * ★ NOT OBSERVED: the third arm. loc_2766 recorded ZERO executions in every pass-14
 * grounding run, so no claim about what taking it means is made here or in any name;
 * its own header describes what the code does, which is all anyone can say about it.
 *
 * NAME: promoted from loc_2745 in understanding pass 15 (proposer != confirmer; the two
 * derivations agree in meaning — carry Mario with whichever lift column he is standing
 * in). Corroboration from OUTSIDE the routine (R5). All three inputs are named ram.js
 * cells: MARIO_X (0x6203) `[seen]`, MARIO_AIRBORNE (0x6216) `[seen]`, and
 * EDGE_REPOSITION_FLAG (0x6398), whose whole lifecycle was lifted this pass — it has
 * exactly ONE setter in the ROM (0x29E8, in the land-on-a-lift arm), which THREE
 * instructions earlier writes MARIO_Y := liftY - 12 (the store is `ld (0x6205),a` at ROM
 * 0x29E2, reached via `ld a,(ix+5) / sub 4 / ld d,a` at 0x29D0 then `ld a,d / sub 8` at
 * 0x29DF; `ld a,1` at 0x29E5 and `ld b,a` at 0x29E7 intervene before the flag store); the
 * grounding then measured liftY - MARIO_Y as 11 or 12 with ZERO drift across 199 frames. So the gate means
 * "Mario is standing on a lift", from the ROM and MAME agreeing on a constant. The
 * band->column mapping is likewise fixed by ROM constants matched to a measurement:
 * ROM 0x27DA spawns a lift at X = 0x37 (55), dead centre of the first band, and ROM
 * 0x2797 teleports one to X = 0x77 (119) the instant it finishes rising, dead centre of
 * the second — and 55/119 are exactly the two X values OBJ_ARRAY_66 (0x6600) `[seen]`
 * records for all six lifts on a live 75m board. Board identity, from RUN-TALLY (the
 * 8,788-frame full-progression run): 347 dispatches, EVERY one board=3 sub=0x0C, zero on
 * boards 1/2/4, and mechanisms.md's board-3 row names elevators and springs, with moving
 * elevator platforms among its cast. The gate's two-sidedness was measured too, in DIFFERENT runs — so
 * these counts do not partition the 347 and must not be added to it: RUN-E0 (a 75m idle
 * control where Mario never boards a lift) dispatched this routine 316 times with the flag
 * clear and every one returned immediately, 0 reaching ROM 0x274F; and the two rides that got
 * past the guards — RUN-E1 (up column) and RUN-E3 (down column) — accounted for the 50 and 62
 * flag-set dispatches, all of which ran a carry, each into the band matching the column Mario
 * was actually riding. RUN-E1 (up) contributed 50, all into carryMarioUpWithLift; RUN-E3 (down) contributed 62, all
 * into carryMarioDownWithLift (pass14-grounding.md 3.2/3.3).
 * There is no fourth bucket to account for: loc_2766 executed ZERO times in every one of
 * those runs.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2745.test.js.
 * GATE:     crafted-entry. 0x2745 is NEVER dispatched in attract (0 over 6000
 *           frames, since reconfirmed at 0 across 24,243 — the flag it gates on is
 *           only raised by boarding a 75m lift, which attract's 25m demo never
 *           does), so crafted entries on a real booted attract base carry the gate:
 *           an EXHAUSTIVE MARIO_X sweep (all 256, so every band boundary) crossed
 *           with a MARIO_Y set that drives both sub-arms of each mover, plus the two
 *           guard early-outs. Teeth: a wrong band boundary, an inverted
 *           reposition-flag guard, and an inverted airborne guard.
 *           ★ Attract-0 is NOT "this code never runs": in real play it fires 347
 *           times across RUN-TALLY's board-3 gameplay (an 8,788-frame full-progression
 *           tape that completes 75m twice, so this is a run total, not a per-board rate). Those real dispatches are a coverage hole
 *           this gate does not replay.
 * LIVE-OUT: memory-only — whatever the dispatched arm writes. This routine reads
 *           three cells and writes none of its own; the caller (the four-byte
 *           loc_271e trampoline, itself a discarded per-frame tail) consumes no
 *           register/flag, and the terminal return is dead ABI. The equivalence test
 *           still lines pc + SP up to prove the dissolved tail-jump/return bracket
 *           matches.
 * NAMES:    EDGE_REPOSITION_FLAG (0x6398), MARIO_AIRBORNE (0x6216), MARIO_X
 *           (0x6203) from ram.js; loc_2766 (ROM 0x2766 — still loc_, never observed
 *           executing), carryMarioUpWithLift (ROM 0x276F) and carryMarioDownWithLift
 *           (ROM 0x2787) direct-called with no register inputs.
 */

import { EDGE_REPOSITION_FLAG, MARIO_AIRBORNE, MARIO_X } from "./ram.js";
import { loc_2766 } from "./loc_2766.js"; // ROM 0x2766 — the never-observed third arm
import { carryMarioUpWithLift } from "./carryMarioUpWithLift.js"; // ROM 0x276F — rising column
import { carryMarioDownWithLift } from "./carryMarioDownWithLift.js"; // ROM 0x2787 — descending column

// Mario's X picks the lift column he is riding. One band per column:
// lifts spawn at X = 55 (0x37) in the first and are teleported to X = 119 (0x77) in the
// second, so each band brackets one column. Every X outside both runs loc_2766.
const MOVER_276F_BAND_LO = 44;   // [44, 67)   = [0x2C, 0x43) -> rising column, carry Mario UP
const MOVER_276F_BAND_HI = 67;
const MOVER_2787_BAND_LO = 108;  // [108, 131) = [0x6C, 0x83) -> descending column, carry him DOWN
const MOVER_2787_BAND_HI = 131;

/**
 * @param {object} m  the machine (uses m.mem; dispatches into loc_2766,
 *                    carryMarioUpWithLift and carryMarioDownWithLift).
 * @returns {void}
 */
export function dispatchElevatorRideByColumn(m) {
  const { mem } = m;

  // Inactive unless Mario is standing on a lift.
  if (mem.read8(EDGE_REPOSITION_FLAG) === 0) return;

  // Busy while airborne — leave the carry for a grounded frame.
  if (mem.read8(MARIO_AIRBORNE) !== 0) return;

  // Dispatch by X band (ascending thresholds, mirroring the oracle's cascade).
  const x = mem.read8(MARIO_X);
  if (x < MOVER_276F_BAND_LO) { loc_2766(m); return; } // left of the rising column
  if (x < MOVER_276F_BAND_HI) { carryMarioUpWithLift(m); return; } // the rising column
  if (x < MOVER_2787_BAND_LO) { loc_2766(m); return; } // between the two columns
  if (x < MOVER_2787_BAND_HI) { carryMarioDownWithLift(m); return; } // the descending column
  loc_2766(m);                                          // right of the descending column
}
