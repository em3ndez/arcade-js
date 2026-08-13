// SPDX-License-Identifier: GPL-3.0-only
/** applyEraRungSettings — load a ten-byte row and scatter it over twelve fixed cells. The row is chosen
 * by (era<<4)+rung indexing a table of row ADDRESSES rather than rows; eight bytes go to one cell each and
 * two to two cells each, in order, nothing read back or returned. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF, ATTACKER_SPAWN_COOLDOWN, ATTACKER_SPAWN_COOLDOWN_PERIOD, ATTACKER_SPAWN_SLOT_COUNT, ATTACKER_SPAWN_WINDOW_HALF, BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD, BANK_LAUNCH_NEAR_HALF_X, BANK_LAUNCH_NEAR_HALF_Y, BANK_LAUNCH_SLOT_COUNT, ERA_INDEX, ERA_RUNG, ROUND_CRAFT_COUNT, SCRIPT_PICK_THRESHOLD, loc_1b04 } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";

const ROWS_PER_ERA = 16;

/** Where each byte of a row lands, in the order the row supplies them. */
const DESTINATIONS = [
  [BANK_LAUNCH_SLOT_COUNT], [BANK_LAUNCH_NEAR_HALF_X], [BANK_LAUNCH_NEAR_HALF_Y], [BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD], [ROUND_CRAFT_COUNT],
  [SCRIPT_PICK_THRESHOLD], [ATTACKER_SPAWN_SLOT_COUNT], [ATTACKER_SPAWN_WINDOW_HALF], [ATTACKER_SPAWN_AIM_WINDOW_HALF], [ATTACKER_SPAWN_COOLDOWN, ATTACKER_SPAWN_COOLDOWN_PERIOD],
];

export function applyEraRungSettings(m) {
  const { mem8, regs } = m;
  regs.a = u8(ROWS_PER_ERA * (mem8[ERA_INDEX] % ROWS_PER_ERA) + mem8[ERA_RUNG]);
  regs.hl = loc_1b04;

  let source = fetchTableWord(m);
  for (const cells of DESTINATIONS) {
    const value = mem8[source];
    for (const cell of cells) mem8[cell] = value;
    source = u16(source + 1);
  }
}
