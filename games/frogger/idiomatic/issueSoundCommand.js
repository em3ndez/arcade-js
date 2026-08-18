// SPDX-License-Identifier: GPL-3.0-only
/**
 * issueSoundCommand — issue one sound command: latch A to the sound-data port, then pulse the /INT edge.
 * LIVE-OUT: IO-only — the sound-data latch and the control-port edge (invisible to a RAM dump).
 */
import { SOUND_CMD_LATCH, SOUND_CTRL_PORT, SOUND_CTRL_SHADOW } from "./names.js";

export function issueSoundCommand(m, cmd = m.regs.a) {
  const { mem8 } = m;
  mem8[SOUND_CMD_LATCH] = cmd;
  const control = mem8[SOUND_CTRL_SHADOW];
  mem8[SOUND_CTRL_PORT] = control & 0xf7; // bit 3 low: the falling edge raises the audio /INT
  mem8[SOUND_CTRL_PORT] = control | 0x08;
}
