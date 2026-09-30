// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only: is everything the free-slot search leaves in registers DEAD once the search is over?
 * Asked of the ORACLE. Extends _spawnPassDeadAtExit.js from the search's count and two cursors to what
 * the shape step (0x323A) and its byte lookup (rst 08) leave when a slot is filled: the step count in C
 * and the landing address in H/L, which the rewrite hands over as arguments and leaves nowhere.
 * deadAfterThePass() poisons them at the driver's exit through assertDeadAtExit (SP exit control, and
 * the record cursor shifted on the slot body's way IN as the entry control); every session must end
 * a search.
 */

import { assertDeadAtExit } from "./_deadAtExit.js";
import { SEARCH_OWNER, SEARCH_REGISTERS, SEARCH_SESSIONS, SLOT_BODY_ENTRY_CONTROL } from "./_spawnPassDeadAtExit.js";

/** What the shape step's register-passing leaves on the frozen side: the step count, the landing address. */
export const SHAPE_STEP_REGISTERS = ["c", "h", "l"];
/** Everything poisoned at the end of the pass. */
export const PASS_REGISTERS = [...SEARCH_REGISTERS, ...SHAPE_STEP_REGISTERS];

export function deadAfterThePass() {
  return assertDeadAtExit({
    at: SEARCH_OWNER, poison: PASS_REGISTERS, sessions: SEARCH_SESSIONS, reachEvery: true,
    controls: [SLOT_BODY_ENTRY_CONTROL],
  });
}
