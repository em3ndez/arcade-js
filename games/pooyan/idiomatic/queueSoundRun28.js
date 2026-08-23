// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundRun28 — append a fixed four-byte sound-command sequence into the sound-command ring, one tile at a time. The
 * final append is a tail call whose result becomes this routine's own.
 *
 * LIVE-OUT: A = the advanced text-ring cursor from the last append (0 when the append gates are
 * shut), propagated through the tail return to stay faithful to the append's exit; this routine's
 * own caller reloads A before use.
 */

const TILE_FIRST = 0x28;
const TILE_SECOND = 0x15;
const TILE_THIRD = 0x16;
const TILE_FOURTH = 0x17;

export function queueSoundRun28(m) {
  appendSoundCommandGated(m, TILE_FIRST);
  appendSoundCommandGated(m, TILE_SECOND);
  appendSoundCommandGated(m, TILE_THIRD);
  return appendSoundCommandGated(m, TILE_FOURTH); // tail: its advanced-cursor result and A write are ours
}
