// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { clearGameActive } from "./clearGameActive.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { otherPlayerFlagPtr } from "./otherPlayerFlagPtr.js";
import { readActivePlayerInput } from "./readActivePlayerInput.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { coordToScreenAddr } from "./coordToScreenAddr.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { clearSpriteColumn } from "./clearSpriteColumn.js";
import { blockCopy } from "./blockCopy.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";
import { newRoundFlow } from "./newRoundFlow.js";
import { gameOverFlow } from "./gameOverFlow.js";
import { doJFlow } from "./doJFlow.js";
import {
  GAME_OBJECT_TABLE, GAME_IN_PROGRESS, TWO_PLAYER_GAME,
  loc_2012, loc_2015, loc_2018, loc_201a, loc_201b, loc_201d,
  loc_2068, loc_2069, loc_206a, loc_206d, loc_1b10, loc_1c70,
} from "./names.js";

/**
 * playerShipHandler — the record-0 (player-ship) object handler the object walker dispatches each frame.
 *
 * WHAT IT IS
 *   The per-frame handler for the player's ship object. On the common pass it just counts the record's
 *   frame timer down and returns. On each timer expiry it steps the ship: it moves the ship's screen column
 *   left or right — by the attract demo script when idle, or by live player input during play — advances the
 *   ship animation one frame, and redraws. When the whole animation counter finally drains it clears the old
 *   sprite footprint and restores the record from its ROM template. During a real game that drain is the
 *   active player's DEATH: it drops the game-active flag and arms one of three next-frame flows (game over,
 *   an extra-life continuation, or a hand-over to the other player), then returns so the engine swaps that
 *   flow in.
 *
 * ROLE IN THE MACHINE
 *   Reached by walkObjectTable, which passes the record pointer (rec+4, here `recPtr`) as the argument; the
 *   handler edits its own 16-byte record in place (see mechanisms.md, "Object-table handlers"). Its ROM
 *   entry is PLAYER_SHIP_HANDLER_ADDR (0x028e). Record/animation cells: recPtr+1 is the animation byte
 *   (0xff = the cursor-arm sentinel), recPtr+2 the inner frame timer, recPtr+3 the outer animation counter;
 *   loc_2012 is the draw-pending flag, loc_2018 the 5-byte sprite descriptor, loc_201a its coordinate word,
 *   loc_1c70 the two-frame sprite base, loc_1b10 the ROM template restored on expiry. Cursor cells: loc_201b
 *   is the ship column (clamped 0x30..0xd9), loc_201d the demo direction (attract), loc_2068/loc_2069/loc_206a
 *   pace the "hold then move" cursor throttle. Death dispatch reads the active page's reserve-ship count
 *   (readActivePlayerPageTopByte), the other-player flag (otherPlayerFlagPtr), and TWO_PLAYER_GAME (0x20ce);
 *   GAME_IN_PROGRESS (0x20ef) distinguishes a real game from the attract demo.
 *
 * ROM 0x028e-0x02ec (+ interior 0x032c / 0x033b-0x03b8).  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: the ship record + its sprite in video RAM; on death, GAME_ACTIVE cleared and m.nextMain armed
 * with the flow the engine runs next frame.
 */
export function playerShipHandler(m, recPtr = m.regs.de) {
  // Shared redraw tail: decode the ship's 5-byte sprite descriptor (loc_2018), resolve its screen address,
  // blit the ship column, and clear the draw-pending flag now that the ship has been repainted.
  function doE() { // shared redraw tail
    loadSpriteDescriptor(m, loc_2018);
    coordToScreenAddr(m);
    drawSpriteColumn(m);
    m.mem8[loc_2012] = 0x00;
  }

  // Move the ship one column right, unless it is already at the right bound (0xd9); then redraw.
  function doF(col) { // nudge the cursor column right, clamped at the right bound
    if (col !== 0xd9) m.mem8[loc_201b] = u8(col + 1);
    return doE();
  }

  // Move the ship one column left, unless it is already at the left bound (0x30); then redraw.
  function doF2(col) { // nudge the cursor column left, clamped at the left bound
    if (col !== 0x30) m.mem8[loc_201b] = u8(col - 1);
    return doE();
  }

  // Choose the move source. In a real game read the active player's joystick (bit 0x40 = right, 0x20 = left);
  // in the attract demo read the scripted demo direction cell loc_201d (bit 0 = right, bit 1 = left). No
  // direction bit set means hold position and just redraw.
  function doC() { // pick the cursor move: live input in-game, else the demo direction cell
    const col = m.mem8[loc_201b];
    if (m.mem8[GAME_IN_PROGRESS] !== 0) {
      const inp = readActivePlayerInput(m);
      if (inp & 0x40) return doF(col);
      if (inp & 0x20) return doF2(col);
      return doE();
    }
    const dir = m.mem8[loc_201d];
    if (dir & 0x01) return doF(col);
    if (dir & 0x02) return doF2(col);
    return doE();
  }

  // Enable the cursor (loc_2069) once the startup hold has elapsed, then move it.
  function doB() { // reseed the pass counter, then move the cursor
    m.mem8[loc_2069] = 0x01;
    return doC();
  }

  // The 0xff-sentinel arm path: mark loc_2068, and gate the very first cursor move behind a pass countdown
  // (loc_206a) so the ship holds briefly on entry before it begins responding. Once enabled (loc_2069 set)
  // or the countdown drains, the cursor moves.
  function doA() { // 0xff sentinel arm: hold the cursor for a pass count before moving it
    m.mem8[loc_2068] = 0x01;
    if (m.mem8[loc_2069] !== 0) return doC();
    const pass = u8(m.mem8[loc_206a] - 1);
    m.mem8[loc_206a] = pass;
    if (pass !== 0) return doC();
    return doB();
  }

  // Advance one animation frame: toggle the two-frame walk (phase bit from the animation byte, written to
  // loc_2015), point the sprite descriptor at loc_1c70 with +0x10 on the low byte for the alternate frame,
  // then redraw.
  function doH(animByte) { // advance one animation frame: alternate the sprite base, redraw
    const phase = u8(animByte + 1) & 0x01;
    m.mem8[loc_2015] = phase;
    const lo = u8((loc_1c70 & 0xff) + (phase << 4));
    m.mem8[loc_2018] = lo;
    m.mem8[loc_2018 + 1] = loc_1c70 >> 8;
    return doE();
  }

  // The record's animation byte selects the mode. 0xff is the cursor-arm sentinel: run the cursor-move path.
  const animByte = m.mem8[recPtr + 1];
  if (animByte === 0xff) return doA();

  // Otherwise count the record's inner frame timer (recPtr+2) down; while it is still running this is the
  // ordinary per-frame pass and there is nothing more to do.
  const inner = u8(m.mem8[recPtr + 2] - 1);
  m.mem8[recPtr + 2] = inner;
  if (inner !== 0) return; // frame timer still running -- the common pass

  // Inner timer expired: reset the cursor-pacing cells, reseed the inner timer, then count the outer
  // animation counter (recPtr+3) down. While animation frames remain, step one frame and return.
  m.mem8[loc_2068] = 0x00;
  m.mem8[loc_2069] = 0x00;
  m.mem8[loc_206a] = 0x30;
  m.mem8[recPtr + 2] = 0x05; // reseed the inner frame timer
  const outer = u8(m.mem8[recPtr + 3] - 1);
  m.mem8[recPtr + 3] = outer;
  if (outer !== 0) return doH(animByte); // more animation frames to run

  // animation done: clear the old sprite footprint and restore the record from its template
  // Wipe the ship's last 16-row sprite column (coordinate from loc_201a), copy the ROM template loc_1b10
  // back over the object record (0x10 bytes), and silence port-3 sound (mask 0x00 clears every cue bit).
  const coord = m.mem8[loc_201a] | (m.mem8[loc_201a + 1] << 8);
  clearSpriteColumn(m, 0x10, coord);
  blockCopy(m, loc_1b10, GAME_OBJECT_TABLE, 0x10);
  clearSoundPort3Bit(m, 0x00);
  // Suppress the restart when the warm-restart-suppress flag is set, and do nothing in the attract demo
  // (there is no game to restart there).
  if (m.mem8[loc_206d] !== 0) return;
  if (m.mem8[GAME_IN_PROGRESS] === 0) return; // attract: nothing to restart

  // player death: hand the engine the next main-loop flow, then return so it swaps in
  // Re-enable interrupts and drop the game-active flag, then pick the next flow by the active player's
  // reserve-ship count and the two-player state:
  m.io.setInte(true);
  clearGameActive(m);
  //   no reserve ships left -> this player is out: game over.
  const [, top] = readActivePlayerPageTopByte(m);
  if (top === 0) { m.nextMain = () => gameOverFlow(m); return; }
  //   the other player is not in play -> continue the SAME player (extra-life continuation, doJFlow).
  const otherPtr = otherPlayerFlagPtr(m);
  if (m.mem8[otherPtr] === 0) { m.nextMain = () => doJFlow(m); return; }
  //   one-player game -> likewise continue the same player.
  if (m.mem8[TWO_PLAYER_GAME] === 0) { m.nextMain = () => doJFlow(m); return; }
  //   two-player game with the other player still in -> hand the turn over (newRoundFlow).
  m.nextMain = () => newRoundFlow(m);
}
