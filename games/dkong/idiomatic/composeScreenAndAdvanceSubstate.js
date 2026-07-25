// SPDX-License-Identifier: GPL-3.0-only
/**
 * composeScreenAndAdvanceSubstate — post this intro step's draw tasks and the "1UP"
 * score marker, then step to the next in-game sub-state.  ROM 0x0A37.
 *
 * Sub-state 5 of the credited game (GAME_STATE 3), dispatched by dispatchInGameSubstate
 * on GAME_SUBSTATE (0x600A) through the 0x0702 table. It is one step of the pre-gameplay
 * "how high can you get?" intro screen-build sequence (sub-states 0–8): its neighbours
 * clear the screen and advance (sub-state 6 → loc_0a63) and run the opening Kong-climb
 * cutscene (sub-state 7 → loc_0a76). This step does three things, no inputs:
 *
 *   1. POST a fixed four-message batch onto the task ring via enqueueTask (the shared
 *      task-post primitive; D = opcode, E = argument): [0x03,0x04], [0x02,0x02],
 *      [0x02,0x00], [0x06,0x00]. The main loop drains the ring and dispatches each
 *      through the handler table at ROM 0x0307 (opcode masked to its low 5 bits) as
 *      deferred draw/setup work. Opcode 0x03 is the corroborated screen-text handler
 *      (see enqueueTaskBatch); handlers 0x02 and 0x06 are the other composition steps of
 *      this screen and are not separately decoded here — the certain fact is the fixed
 *      batch that is posted.
 *   2. ADVANCE. Increment GAME_SUBSTATE (0x600A) by one (8-bit RMW), so next frame's
 *      dispatch selects sub-state 6.
 *   3. STAMP player 1's static "1UP" score marker — 0x7740<-'1', 0x7720<-'U', 0x7700<-'P'
 *      — which in the ROM is the fall-through tail this routine shares with sub_0a53
 *      (draw1UpLabel). Expressed here as a direct call to that already-decompiled leaf.
 *
 * A LEAF over enqueueTask + draw1UpLabel: writes only the task ring + its tail, the
 * sub-state byte, and the three marker cells. Reads no register and no input byte.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a37.test.js.
 * GATE:     crafted-entry — one real captured dispatch from a driven coin+start game
 *           (sub-state 5 fires once per board intro, ring empty → the no-wrap post arm),
 *           fresh clone per case, PLUS crafted ring states the run never reaches (FULL
 *           ring → every post dropped; near-wrap tail → the batch wraps 0xFF→0xC0),
 *           poked identically on both sides. Teeth = skip-the-advance and wrong-task-byte
 *           twins the diff must catch.
 * LIVE-OUT: memory-only — the task ring + TASK_TAIL (via enqueueTask), GAME_SUBSTATE, and
 *           the three marker cells (via draw1UpLabel). The oracle's residual A/DE/HL/flags
 *           are dead ABI: this is a sub-state handler reached by rst-0x28 dispatch and its
 *           `ret` returns up the NMI service path, which consumes none of them. pc/SP are
 *           the dropped stack model — the oracle's four `call`s and terminal `ret` leave
 *           only push residue in STACK_SCRATCH (measured 0x6bea–0x6bed at the real
 *           dispatch), excluded by the contract; the direct-call layer replaces the `ret`
 *           with a JS return, so this routine leaves SP/pc untouched.
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js; imports enqueueTask (ROM 0x309F) and
 *           draw1UpLabel (ROM 0x0A53), the two decompiled callees. The task opcode/argument
 *           bytes are the fixed message payloads, kept literal (not RAM addresses).
 */

import { GAME_SUBSTATE } from "../optimized/ram.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw1UpLabel } from "./draw1UpLabel.js";

// The fixed batch of deferred-work messages this step posts, as [opcode, argument]
// pairs in post order — the oracle's four `ld de,NNNN / call 0x309f` (D = high byte
// = opcode, E = low byte = argument).
const SCREEN_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
  [0x06, 0x00],
];

export function composeScreenAndAdvanceSubstate(m) {
  const { regs, mem } = m;

  // 1. Post the four fixed messages. enqueueTask reads the pair from D/E, so marshal
  //    each into regs.d/regs.e before the call (it never writes them back).
  for (const [opcode, argument] of SCREEN_TASKS) {
    regs.d = opcode;
    regs.e = argument;
    enqueueTask(m);
  }

  // 2. Advance the in-game sub-state selector (8-bit wrap, matching `inc (hl)` on 0x600A).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 3. Stamp player 1's static "1UP" marker — the ROM fall-through tail into sub_0a53.
  draw1UpLabel(m);
}
