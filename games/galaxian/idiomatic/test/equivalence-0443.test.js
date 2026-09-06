// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0443 — equivalent to the frozen oracle. Fills two blank-tile rows through the VRAM write cursor and
 * steps it a full stride, then counts down the row tier. RUN path (tier>1 after the decrement): only the
 * fills + cursor + tier, all RAM -> ramDiff. LAST path (tier==1): also bumps the state, clears the two
 * screen-flip latches (io.flipX/flipY, NOT in the dump) and a direction flag, queues two command words,
 * and drives the start-button lamps (io.startLamp, NOT in the dump). EQUAL asserts ramDiff on both paths,
 * plus io flip + lamp equality on the last path. Teeth: no-op + a VRAM scribble (RAM), a flip-keeping and
 * a lamp-keeping twin (io). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { blankVramRowsThenDriveStartLamps as cand } from "../blankVramRowsThenDriveStartLamps.js";
import { loc_0443 as oracle } from "../../translated/loc_0443.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PTR = 0x400b;         // VRAM write cursor (16-bit)
const TIER = 0x4009;        // row countdown
const STATE = 0x400a;
const DIR_FLAG = 0x4018;
const ENABLE_FLAG = 0x425f; // bit5 gates the start lamps
const FILL_BASE = 0x5100;   // VRAM region the cursor points at
const HEAD = 0x40a0, SLOT0 = 0x40c0, SLOT2 = 0x40c2;

function base(mem, m) {
  m.push16(0x9999);
  mem[PTR] = FILL_BASE & 0xff; mem[PTR + 1] = (FILL_BASE >> 8) & 0xff;
  for (let i = 0; i < 64; i++) mem[(FILL_BASE + i) & 0xffff] = 0xee; // sentinels across the fill span
}

const runEntry = () => craft((mem, m) => { base(mem, m); mem[TIER] = 3; });
const lastEntry = () => craft((mem, m) => {
  base(mem, m);
  mem[TIER] = 1;
  mem[STATE] = 5; mem[DIR_FLAG] = 1;
  mem[HEAD] = 0xc0; mem[SLOT0] = 0x80; mem[SLOT2] = 0x80;
  mem[ENABLE_FLAG] = 0; // bit5 clear -> the lamp delegate clears both lamps
  m.mem.io.setFlipX(1); m.mem.io.setFlipY(1);
  m.mem.io.setStartLamp(0, 1); m.mem.io.setStartLamp(1, 1);
});

const flipsAfter = (fn, e) => { const m = e.clone(); m.routines = STUBS; fn(m); return [m.mem.io.flipX, m.mem.io.flipY]; };
const lampsAfter = (fn, e) => { const m = e.clone(); m.routines = STUBS; fn(m); return [m.mem.io.startLamp[0], m.mem.io.startLamp[1]]; };
const cursorAfter = (a) => a.mem8[PTR] | (a.mem8[PTR + 1] << 8);

test("EQUAL (crafted): loc_0443 == oracle on the run path (rows remain)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "loc_0443 diverged on the run path");
  const a = runEntry(); oracle(a);
  assert.equal(a.mem8[FILL_BASE], 0x10, "positive control: first row filled");
  assert.equal(a.mem8[(FILL_BASE + 32) & 0xffff], 0x10, "positive control: second row filled");
  assert.equal(a.mem8[TIER], 2, "positive control: tier decremented");
  assert.equal(cursorAfter(a), (FILL_BASE + 0x40) & 0xffff, "positive control: cursor advanced a full stride");
  console.log("  EQUAL: loc_0443 == oracle (RAM), two rows filled, tier 3->2");
});

test("EQUAL (crafted): loc_0443 == oracle on the last row (full advance)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, lastEntry()), null, "loc_0443 diverged on the last-row path");
  assert.deepEqual(flipsAfter(cand, lastEntry()), flipsAfter(oracle, lastEntry()), "screen-flip latches diverged");
  assert.deepEqual(lampsAfter(cand, lastEntry()), lampsAfter(oracle, lastEntry()), "start lamps diverged");
  const a = lastEntry(); oracle(a);
  assert.equal(a.mem8[TIER], 0, "positive control: tier hit 0");
  assert.equal(a.mem8[STATE], 6, "positive control: state bumped");
  assert.equal(a.mem8[DIR_FLAG], 0, "positive control: direction flag cleared");
  assert.equal(a.mem8[SLOT0], 0x07, "positive control: first command word queued");
  assert.deepEqual(flipsAfter(oracle, lastEntry()), [0, 0], "positive control: screen-flip latches cleared");
  assert.deepEqual(lampsAfter(oracle, lastEntry()), [0, 0], "positive control: lamps cleared by the delegate");
  console.log("  EQUAL: loc_0443 == oracle (RAM + io flips + lamps), last row -> full advance");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[FILL_BASE] ^= 0xff; };
  const keepFlips = (m) => { cand(m); m.mem.io.setFlipX(1); m.mem.io.setFlipY(1); };
  const keepLamps = (m) => { cand(m); m.mem.io.setStartLamp(0, 1); m.mem.io.setStartLamp(1, 1); };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribble, runEntry()), "the VRAM-scribble twin escaped");
  assert.notDeepEqual(flipsAfter(keepFlips, lastEntry()), flipsAfter(oracle, lastEntry()), "the flip-keeping twin escaped (io)");
  assert.notDeepEqual(lampsAfter(keepLamps, lastEntry()), lampsAfter(oracle, lastEntry()), "the lamp-keeping twin escaped (io)");
  console.log("  TEETH: no-op, VRAM scribble (RAM), flip-keeping + lamp-keeping (io) all caught");
});
