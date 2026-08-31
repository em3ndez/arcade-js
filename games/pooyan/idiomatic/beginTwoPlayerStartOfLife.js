// SPDX-License-Identifier: GPL-3.0-only
import { startNewGamePlay } from "./startNewGamePlay.js";
/**
 * beginTwoPlayerStartOfLife — the two-player entry into the start-of-life setup.
 *
 * ROM 0x0da8.  Grounding: [seen].
 *
 * WHAT IT IS
 *   A tiny stub that stands immediately in front of the shared start-of-life setup
 *   (startNewGamePlay, ROM 0x0dab). Its whole job is to load one 16-bit player-configuration word
 *   and then continue, unbroken, into that setup. The setup has two front doors that differ only in
 *   the word they arrive with: this one announces "a two-player game, player 1 first", while the
 *   one-player start reaches the setup with a zero word. Whether the machine plays a one- or a
 *   two-player game is decided entirely by which door was taken, and therefore by which word is in
 *   HL when the setup begins.
 *
 * ROLE IN THE MACHINE
 *   The start-of-life setup writes the player configuration down from a single 16-bit word: its LOW
 *   byte becomes the active-player index in ACTIVE_PLAYER (0x880d) and its HIGH byte becomes the
 *   two-player flag in TWO_PLAYER_FLAG (0x880e). This entry seeds that word as 0x0100 (256):
 *     - high byte 0x01 -> TWO_PLAYER_FLAG set: a second player exists, so the game alternates turns
 *       out of one shared live round page (a death hands the page over to the other player).
 *     - low  byte 0x00 -> ACTIVE_PLAYER 0: player 1 (index 0) takes the first life.
 *   Splitting the one word across those two adjacent cells lets all the downstream round logic
 *   address one fixed player index and one fixed "is this a two-player game?" flag, oblivious to how
 *   the game was started or whose turn it is.
 *
 * LIVE-OUT: memory only — whatever the start-of-life setup leaves behind (the committed player
 *   configuration in 0x880d/0x880e, the top-level state cells switched to in-play, the freshly reset
 *   actor/sprite tables, and the queued pre-play / start-of-life display and sound commands). No
 *   register is read back by the caller.
 */
export function beginTwoPlayerStartOfLife(m) {
  // Load HL with the two-player configuration word 0x0100 = 256 (ROM 0x0da8: ld hl,0x0100) and
  // continue straight into the shared start-of-life setup at ROM 0x0dab, which splits that word
  // into ACTIVE_PLAYER (0x880d, low byte 0 -> player 1 first) and TWO_PLAYER_FLAG (0x880e, high
  // byte 1 -> two players), commits the in-play state, and opens the first life.
  return (m.regs.hl = 256), startNewGamePlay(m, 256); // 0x0100: two-player flag set, player 1 first
}
