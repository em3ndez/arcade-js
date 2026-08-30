// SPDX-License-Identifier: GPL-3.0-only
import {
  GAME_ACTIVE_FLAG,
  ACTIVE_PLAYER,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  PLAY_TIMER_BCD_P1,
  PLAY_TIMER_BCD_P2,
} from "./names.js";
/**
 * loc_7912 — advance the active player's on-screen play clock by one frame. [seen]
 *
 * ROM 0x7912-0x795f. A pure leaf: it reads the machine's play state and edits one three-byte
 * timer bank, calling nothing.
 *
 * WHAT IT IS. Each player owns a small "play timer" that displays as a MM:SS-style clock. It is
 * stored as three consecutive bytes: a base FRAME sub-counter, then a packed-BCD SECONDS digit,
 * then a packed-BCD MINUTES digit. BCD (binary-coded decimal) keeps each decimal digit in its own
 * nibble, so 0x59 reads as decimal 59 directly — no binary-to-decimal conversion is needed when the
 * value is later drawn. This routine is the once-per-frame heartbeat that carries that clock along.
 *
 * ROLE IN THE MACHINE. The board driver calls it every frame during play. Because the NTSC display
 * runs at ~60 frames per second but a decimal second wants an exact tick, the frame sub-counter must
 * roll over after slightly more than 59 frames on average. The hardware does this by alternating the
 * roll point between 0x3b (59) and 0x3c (60): the choice is taken from bit 0 of the SECONDS byte, so
 * odd seconds get one extra frame. Averaged over two seconds that is 59.5 frames per tick, keeping
 * the shown clock close to real time on a 60Hz machine.
 *
 * TWO INDEPENDENT BANKS. Player 1 and player 2 each keep their own gate + timer, so a running clock
 * is frozen while the other player is up. GAME_ACTIVE_FLAG (0x8806) is the global in-play gate;
 * ACTIVE_PLAYER (0x880d) selects which bank is live.
 *
 * LIVE-OUT: none — writes only the selected timer cells; the caller consumes no register or flag.
 */
export function loc_7912(m) {
  const { mem8 } = m;

  // Global in-play gate: GAME_ACTIVE_FLAG (0x8806) is 1 from start-of-life to game-over and 0 in
  // attract. With no game running there is no clock to advance.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return; // game inactive

  // Pick this player's bank. ACTIVE_PLAYER (0x880d) is 0 for player 1, nonzero for player 2; each
  // player has an independent gate byte and its own three-byte timer bank.
  const player1 = mem8[ACTIVE_PLAYER] === 0;
  const gate = player1 ? PLAY_TIMER_GATE_P1 : PLAY_TIMER_GATE_P2;
  const timer = player1 ? PLAY_TIMER_BCD_P1 : PLAY_TIMER_BCD_P2;

  // Per-player suppression: a nonzero gate byte (0x89e1/0x89e2) freezes this clock — e.g. during a
  // paused phase where the visible timer must hold — so the tick is skipped entirely.
  if (mem8[gate] !== 0) return; // gate set: skip this pair

  // Choose the frame roll point from bit 0 of the SECONDS byte (timer+1): even seconds roll at 0x3b
  // (59 frames), odd seconds at 0x3c (60). This 59/60 alternation trims the average tick to ~59.5
  // frames, correcting the 60Hz frame rate toward true decimal seconds.
  const frameLimit = mem8[timer + 1] & 0x01 ? 0x3c : 0x3b;

  // Below the roll point: just count one more frame and leave the BCD digits untouched.
  if (mem8[timer] !== frameLimit) {
    mem8[timer] = mem8[timer] + 1; // below the limit: advance the sub-counter (mem8 truncates to 8 bits)
    return;
  }

  // Reached the roll point: a whole second has elapsed. Zero the frame sub-counter and carry one
  // second into the BCD digits below.
  mem8[timer] = 0x00; // at the limit: roll the frame sub-counter

  // Carry into the SECONDS digit (timer+1). Bump it, then test the low nibble: a BCD digit's low
  // nibble is valid 0..9, so a value of 0x0a means the units place overflowed and must carry.
  let digit = timer + 1;
  let v = (mem8[digit] + 1) & 0xff;
  if ((v & 0x0f) !== 0x0a) {
    mem8[digit] = v; // no BCD overflow: store the incremented seconds and stop
    return;
  }

  // Units place hit 10: clear the low nibble and add 0x10 to carry into the tens-of-seconds nibble.
  v = (v & 0xf0) + 0x10; // low nibble overflowed: carry into the high nibble
  if (v !== 0x60) {
    mem8[digit] = v; // tens-of-seconds still below 6: store and stop
    return;
  }

  // Seconds reached 60 (0x60 in BCD = six tens, zero units): the seconds digit wraps to 00 and one
  // minute carries into the MINUTES digit at timer+2.
  mem8[digit] = 0x00;
  digit = timer + 2;
  v = (mem8[digit] + 1) & 0xff;
  if ((v & 0x0f) !== 0x0a) {
    mem8[digit] = v; // minutes units place did not overflow: store and stop
    return;
  }

  // Minutes units place hit 10: clear the low nibble and carry into the tens-of-minutes nibble. No
  // further wrap is handled here — the displayed clock never runs long enough to reach 60 minutes.
  mem8[digit] = (v & 0xf0) + 0x10; // minutes low nibble overflowed: carry into its high nibble
}
