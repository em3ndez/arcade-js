// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_073d — memory-equivalent to the frozen oracle. Counts the dwell timer at 0x4009 down; while it is
 * still nonzero it just decrements and returns. On expiry it clears SEQUENCE_STATE (0x400a), 0x4222 and
 * 0x422b, packs bit 0 of the 128 flag bytes (0x4100) into the 16-byte bitmap at 0x4180, copies the 8-byte
 * template (0x4218) into the 8 cells just past the bitmap (0x4190), sets 0x400d=1 and advances GAME_STATE
 * (0x4005)=4. The bitmap-end pointer the packer returns is consumed internally as the copy destination, so
 * a memory diff validates the threading. Two paths exercised: timer running (plain dec) and timer expiring
 * (full sequence). Live-out is work RAM only; the return-stack window is masked. Teeth: no-op and dec-only
 * on the running/expiring paths plus a packed-bitmap scribble.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { packFlagsToBitmapAndSwitchPlayerState as cand } from "../packFlagsToBitmapAndSwitchPlayerState.js";
import { loc_073d as oracle } from "../../translated/loc_073d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DWELL = 0x4009;      // countdown timer
const SEQ_STATE = 0x400a;  // cleared on expiry
const FLAG_A = 0x4222;     // cleared on expiry
const FLAG_B = 0x422b;     // cleared on expiry
const FLAG_BLOCK = 0x4100; // 128 flag bytes, bit 0 packed
const BITMAP = 0x4180;     // 16-byte packed bitmap
const COPY_DEST = 0x4190;  // 8-byte template copy destination (bitmap + 16)
const TEMPLATE = 0x4218;   // 8-byte template source
const CURRENT_PLAYER = 0x400d;
const GAME_STATE = 0x4005;

// Timer running: a plain decrement, no expiry work.
const running = () => craft((mem, m) => { m.push16(0x9999); mem[DWELL] = 5; });

// Timer expiring: full sequence. Zero the flag block then set two bits so the packed byte is 0x81,
// seed a distinct template, and dirty the fields the expiry clears/sets.
const expiring = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[DWELL] = 1;
  for (let i = 0; i < 128; i++) mem[FLAG_BLOCK + i] = 0;
  mem[FLAG_BLOCK + 0] = 1; // -> bitmap byte 0, bit 0
  mem[FLAG_BLOCK + 7] = 1; // -> bitmap byte 0, bit 7
  for (let i = 0; i < 8; i++) mem[TEMPLATE + i] = 0xa0 + i;
  mem[SEQ_STATE] = 7;
  mem[FLAG_A] = 9;
  mem[FLAG_B] = 9;
  mem[CURRENT_PLAYER] = 0;
  mem[GAME_STATE] = 0;
});

const noOp = () => {};
const decOnly = (m) => { m.mem8[DWELL] = (m.mem8[DWELL] - 1) & 0xff; }; // never runs the expiry body
const scribbleBitmap = (m) => { cand(m); m.mem8[BITMAP] ^= 0xff; };

test("EQUAL (crafted): loc_073d == oracle, timer running", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, running()), null, "loc_073d diverged on the running path");
  const seedGameState = running().mem8[GAME_STATE];
  const a = running(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DWELL], 4, "positive control: timer 5->4");
  assert.equal(a.mem8[GAME_STATE], seedGameState, "positive control: expiry body not run (game state unchanged)");
  console.log("  EQUAL: loc_073d == oracle (RAM), timer 5->4, no expiry work");
});

test("EQUAL (crafted): loc_073d == oracle, timer expiring", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiring()), null, "loc_073d diverged on the expiring path");
  const a = expiring(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ_STATE], 0, "control: SEQUENCE_STATE cleared");
  assert.equal(a.mem8[FLAG_A], 0, "control: 0x4222 cleared");
  assert.equal(a.mem8[FLAG_B], 0, "control: 0x422b cleared");
  assert.equal(a.mem8[BITMAP], 0x81, "control: flag bytes packed (bit0+bit7) to 0x81");
  assert.equal(a.mem8[COPY_DEST], 0xa0, "control: template byte 0 copied past the bitmap");
  assert.equal(a.mem8[COPY_DEST + 7], 0xa7, "control: template byte 7 copied past the bitmap");
  assert.equal(a.mem8[CURRENT_PLAYER], 1, "control: current player set");
  assert.equal(a.mem8[GAME_STATE], 4, "control: game state advanced to 4");
  console.log("  EQUAL: loc_073d == oracle (clears + packed bitmap 0x81 + template copy + state 4)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, running()), "the no-op twin escaped (running)");
  assert.ok(ramDiff(oracle, decOnly, expiring()), "the dec-only twin escaped (expiring)");
  assert.ok(ramDiff(oracle, scribbleBitmap, expiring()), "the bitmap-scribble twin escaped");
  console.log("  TEETH: no-op (running), dec-only (expiring), bitmap-scribble all caught (RAM)");
});
