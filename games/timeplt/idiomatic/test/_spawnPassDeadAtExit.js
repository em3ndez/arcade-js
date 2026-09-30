// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only: what every free-slot-search DEAD AT EXIT arm shares. Every way into the search is a TAIL
 * of the per-phase enemy-wave driver at 0x36af (each hands on with a jump, never a call), so poisoning
 * at the driver's exit poisons the search's registers at the end of every search, whichever entry
 * started it. _spawnPassScratchDeadAtExit.js runs it through assertDeadAtExit.
 */

import { ENTRY_FRAMES } from "./_harness.js";

/** The per-phase enemy-wave driver every entry of the search is a tail of. */
export const SEARCH_OWNER = 0x36af;
const SLOT_BODY = 0x37d6;
const RECORD_STRIDE = 16;

/** ENTRY CONTROL: the record cursor shifted one record on the slot body's way IN, where it is read. */
export const SLOT_BODY_ENTRY_CONTROL = {
  label: "entry (record cursor one record on, into the slot body)",
  at: SLOT_BODY, poison: ["ix"], flip: { ix: RECORD_STRIDE }, before: true,
};

export const SEARCH_REGISTERS = ["b", "ix", "iy"];

export const SEARCH_SESSIONS = [
  { label: "coin-start", tape: undefined, frames: ENTRY_FRAMES },
  { label: "attract", tape: [], frames: 3000 },
];
