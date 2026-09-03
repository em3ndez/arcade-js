// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { clearGameActive } from "./clearGameActive.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { loc_18e7 } from "./loc_18e7.js";
import { readActivePlayerInput } from "./readActivePlayerInput.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { coordToScreenAddr } from "./coordToScreenAddr.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { clearSpriteColumn } from "./clearSpriteColumn.js";
import { blockCopy } from "./blockCopy.js";
import { loc_19dc } from "./loc_19dc.js";
import { newRoundFlow } from "./newRoundFlow.js";
import { gameOverFlow } from "./gameOverFlow.js";
import { doJFlow } from "./doJFlow.js";
import {
  GAME_OBJECT_TABLE, GAME_IN_PROGRESS, TWO_PLAYER_GAME,
  loc_2012, loc_2015, loc_2018, loc_201a, loc_201b, loc_201d,
  loc_2068, loc_2069, loc_206a, loc_206d, loc_1b10, loc_1c70,
} from "./names.js";

// The record-0 timer/animation object handler reached by the table walker. Count the record's frame timer
// down each pass and return while it runs. On each inner expiry step the marching-cursor animation (pick a
// new sprite frame, nudge the cursor column left/right by demo script or live input, redraw), and when the
// whole animation counter drains, restore the record from its stored template. If a game is in progress
// that drain is the active player's death: it arms the next main-loop flow -- game over, an extra-life
// continuation, or a fresh round -- and returns so the engine swaps in that flow.
export function loc_028e(m, recPtr = m.regs.de) {
  function doE() { // shared redraw tail
    loadSpriteDescriptor(m, loc_2018);
    coordToScreenAddr(m);
    drawSpriteColumn(m);
    m.mem8[loc_2012] = 0x00;
  }

  function doF(col) { // nudge the cursor column right, clamped at the right bound
    if (col !== 0xd9) m.mem8[loc_201b] = u8(col + 1);
    return doE();
  }

  function doF2(col) { // nudge the cursor column left, clamped at the left bound
    if (col !== 0x30) m.mem8[loc_201b] = u8(col - 1);
    return doE();
  }

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

  function doB() { // reseed the pass counter, then move the cursor
    m.mem8[loc_2069] = 0x01;
    return doC();
  }

  function doA() { // 0xff sentinel arm: hold the cursor for a pass count before moving it
    m.mem8[loc_2068] = 0x01;
    if (m.mem8[loc_2069] !== 0) return doC();
    const pass = u8(m.mem8[loc_206a] - 1);
    m.mem8[loc_206a] = pass;
    if (pass !== 0) return doC();
    return doB();
  }

  function doH(animByte) { // advance one animation frame: alternate the sprite base, redraw
    const phase = u8(animByte + 1) & 0x01;
    m.mem8[loc_2015] = phase;
    const lo = u8((loc_1c70 & 0xff) + (phase << 4));
    m.mem8[loc_2018] = lo;
    m.mem8[loc_2018 + 1] = loc_1c70 >> 8;
    return doE();
  }

  const animByte = m.mem8[recPtr + 1];
  if (animByte === 0xff) return doA();

  const inner = u8(m.mem8[recPtr + 2] - 1);
  m.mem8[recPtr + 2] = inner;
  if (inner !== 0) return; // frame timer still running -- the common pass

  m.mem8[loc_2068] = 0x00;
  m.mem8[loc_2069] = 0x00;
  m.mem8[loc_206a] = 0x30;
  m.mem8[recPtr + 2] = 0x05; // reseed the inner frame timer
  const outer = u8(m.mem8[recPtr + 3] - 1);
  m.mem8[recPtr + 3] = outer;
  if (outer !== 0) return doH(animByte); // more animation frames to run

  // animation done: clear the old sprite footprint and restore the record from its template
  m.regs.hl = m.mem8[loc_201a] | (m.mem8[loc_201a + 1] << 8);
  clearSpriteColumn(m, 0x10);
  blockCopy(m, loc_1b10, GAME_OBJECT_TABLE, 0x10);
  loc_19dc(m, 0x00);
  if (m.mem8[loc_206d] !== 0) return;
  if (m.mem8[GAME_IN_PROGRESS] === 0) return; // attract: nothing to restart

  // player death: hand the engine the next main-loop flow, then return so it swaps in
  m.io.setInte(true);
  clearGameActive(m);
  const [, top] = readActivePlayerPageTopByte(m);
  if (top === 0) { m.nextMain = () => gameOverFlow(m); return; }
  const otherPtr = loc_18e7(m);
  if (m.mem8[otherPtr] === 0) { m.nextMain = () => doJFlow(m); return; }
  if (m.mem8[TWO_PLAYER_GAME] === 0) { m.nextMain = () => doJFlow(m); return; }
  m.nextMain = () => newRoundFlow(m);
}
