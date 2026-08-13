// SPDX-License-Identifier: GPL-3.0-only
/** seedGameConfigFromDipSwitches — seed the settings block from the two switch banks and hand off to the unpackers.
 * Two boot bytes are copied into their working cells, the first bank is stored complemented and
 * unpacked into the coin ratios, and the second bank's low two bits become a lives count -- 3, 4,
 * 5, or all-ones for the setting that folds to none -- carried on with the whole complemented bank
 * into the peeler that opens the rest. Control never comes back.
 * LIVE-OUT: the three seeded cells, whatever the unpackers leave, and the peeler's return. */

import { u8 } from "../../../core/int.js";
import { unpackCoinage } from "./unpackCoinage.js";
import { unpackTheFirstThreeSwitchSettings } from "./unpackTheFirstThreeSwitchSettings.js";
import { COINAGE_SETTINGS, HIGH_SCORE_HI, KILL_QUOTA, loc_08c9, loc_0874, loc_c360, loc_c200 } from "./names.js";

const LIVES_BASE = 3;
const FOLDS_TO = 0x06;
const ALL_ONES = 0xff;

export function seedGameConfigFromDipSwitches(m) {
  const { mem8, regs } = m;
  mem8[HIGH_SCORE_HI] = mem8[loc_08c9];
  mem8[KILL_QUOTA] = mem8[loc_0874];
  mem8[COINAGE_SETTINGS] = u8(~mem8[loc_c360]);
  unpackCoinage(m);

  const bank1 = u8(~mem8[loc_c200]);
  const lives = (bank1 & 0x03) + LIVES_BASE;
  regs.a = lives === FOLDS_TO ? ALL_ONES : lives;
  regs.c = bank1;
  return unpackTheFirstThreeSwitchSettings(m);
}
