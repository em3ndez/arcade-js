// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * loc_0fc1 — enqueue the four-tile text sequence 0x29,0x15,0x16,0x17 into the sound-command ring.
 *
 * Each tile is handed to the frozen text-ring append (which reads A); the final append is a tail
 * call whose ret returns to our caller.
 *
 * LIVE-OUT: memory only — the tiles appended to the sound-command ring.
 */
const TILES = [0x29, 0x15, 0x16, 0x17]; //  glyph codes appended in order

export function loc_0fc1(m) {
  appendSoundCommandGated(m, TILES[0]); // text tiles appended one at a time
  appendSoundCommandGated(m, TILES[1]);
  appendSoundCommandGated(m, TILES[2]);
  return appendSoundCommandGated(m, TILES[3]); // tail append
}
