// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommands95And03And11 — append three fixed command bytes (0x95, 0x03, 0x11) into the command ring.
 *
 * Each byte is handed to the ring-append helper; the third is a tail call, so this routine's
 * result is the helper's result from that last append.
 *
 * LIVE-OUT: A = the ring cursor the final append leaves (0 when the append gates are closed),
 * set through the helper's return-assignment bridge and read the same way any append site reads it.
 */

const CMD_A = 0x95;
const CMD_B = 0x03;
const CMD_C = 0x11;

export function queueSoundCommands95And03And11(m) {
  appendSoundCommandGated(m, CMD_A);
  appendSoundCommandGated(m, CMD_B);
  return appendSoundCommandGated(m, CMD_C);
}
