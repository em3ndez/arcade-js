// SPDX-License-Identifier: GPL-3.0-only
/**
 * readControls — select the active joystick port and edge-debounce it into the cooked control
 * word the movement code reads.
 *
 * LIVE-OUT: memory-only — P1_INPUT and P1_INPUT_RAW.
 */

import {
  ACTIVE_PLAYER_INDEX,
  DIP_UPRIGHT,
  IN1_PORT,
  P1_INPUT,
  P1_INPUT_RAW,
} from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

const IN0 = 0x7c00; // player-1 joystick port (hardware input)
const COCKTAIL_PLAYER_SELECT = ACTIVE_PLAYER_INDEX; // non-zero => read IN1_PORT on a cocktail cabinet

export function readControls(m) {
  const { mem, mem8 } = m;

  let raw;
  if (mem8[DIP_UPRIGHT] !== 0) {
    raw = mem.read8(IN0);
  } else if (mem8[COCKTAIL_PLAYER_SELECT] !== 0) {
    raw = mem.read8(IN1_PORT);
  } else {
    raw = mem.read8(IN0);
  }

  const direction = raw & 0x0f;
  const prevRaw = mem8[P1_INPUT_RAW];
  // Edge-detect the jump bit: keep bit 4 only where it went 0->1, then lift it to bit 7.
  const jumpEdge = (((~prevRaw) & raw) & 0x10) << 3; // 0x00 or 0x80
  const cooked = jumpEdge | direction;

  mem8[P1_INPUT] = cooked;
  mem8[P1_INPUT_RAW] = raw;

  // The store above lands before this throws, so both output bytes are already written.
  if (raw & 0x40) {
    throw new NotImplemented(
      "input bit 6 set: jp 0x0000 at ROM 0x00B2 -- soft reset via input, " +
        "path not yet exercised",
    );
  }
}
