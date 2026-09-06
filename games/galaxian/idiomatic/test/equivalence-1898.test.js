// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1898 — equivalent to the frozen oracle at ROM 0x1898. Dispatches the LFO frequency updater:
 *   - REQUEST: the reset-request flag (0x41d0) set -> clear it, store level 0x0f, fan it (rotated) across
 *     the four LFO latches 0x6004-7.
 *   - DECAY: flag clear -> per-frame decay path; on the 0xff parity tick with a nonzero level, drop the
 *     level and re-fan it.
 *   - IDLE: flag clear, decay not armed -> nothing happens.
 * The level store (0x421f) and flag clear (0x41d0) are RAM (in the dump); the four latch writes hit the
 * sound DEVICE (io.soundLfo), NOT the dump. So EQUAL asserts ramDiff==null AND io.soundLfo equality.
 * Teeth: a request-ignoring no-op (RAM), a no-rotate twin (io only), a decay-ignoring no-op (RAM).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { driveSoundLfoLevel as cand } from "../driveSoundLfoLevel.js";
import { loc_1898 as oracle } from "../../translated/loc_1898.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REQ = 0x41d0;    // reset-request flag
const LEVEL = 0x421f;  // LFO level shadow
const PARITY = 0x425f; // per-frame parity tick
const LFO = 0x6004;    // first LFO frequency latch (device, not RAM)

// Reset request pending.
const request = () => craft((mem, mm) => { mm.push16(0x9999); mem[REQ] = 1; mem[LEVEL] = 0x33; });
// No request, decay armed (0xff tick) with a nonzero level.
const decay = () => craft((mem, mm) => { mm.push16(0x9999); mem[REQ] = 0; mem[PARITY] = 0xff; mem[LEVEL] = 0x20; });
// No request, decay not armed -> nothing happens.
const idle = () => craft((mem, mm) => { mm.push16(0x9999); mem[REQ] = 0; mem[PARITY] = 0x01; mem[LEVEL] = 0x20; });

// The four LFO latch values the sound device recorded after running `fn` from the seed.
function lfoAfter(fn, e) {
  const x = e.clone(); x.routines = STUBS; fn(x); return Array.from(x.mem.io.soundLfo);
}

test("EQUAL (crafted): loc_1898 == oracle slams the LFO on a reset request", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, request()), null, "loc_1898 diverged on the request path (RAM)");
  const e = request();
  assert.deepEqual(lfoAfter(cand, e), lfoAfter(oracle, e), "loc_1898 diverged on the LFO latches");
  const a = request(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[REQ], 0, "positive control: request flag not consumed");
  assert.equal(a.mem8[LEVEL], 0x0f, "positive control: level not forced to 0x0f");
  assert.equal(lfoAfter(oracle, request())[0], 0x0f, "positive control: first latch not 0x0f");
  console.log("  EQUAL: loc_1898 == oracle, request -> level 0x0f fanned across the latches");
});

test("EQUAL (crafted): loc_1898 == oracle runs the decay path with no request", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, decay()), null, "loc_1898 diverged on the decay path (RAM)");
  const e = decay();
  assert.deepEqual(lfoAfter(cand, e), lfoAfter(oracle, e), "loc_1898 diverged on the decay LFO latches");
  const a = decay(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[LEVEL], 0x1f, "positive control: decay did not drop the level 0x20->0x1f");
  console.log("  EQUAL: loc_1898 == oracle, decay -> level 0x20->0x1f re-fanned");
});

test("EQUAL (crafted): loc_1898 == oracle idles when neither path acts", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, idle()), null, "loc_1898 diverged on the idle path (RAM)");
  const a = idle(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[LEVEL], 0x20, "positive control: idle must leave the level untouched");
  console.log("  EQUAL: loc_1898 == oracle, idle -> nothing written");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Correct RAM footprint but every latch gets the raw level (no rotation) — caught only on io.
  const noRotate = (m) => {
    m.mem8[REQ] = 0; m.mem8[LEVEL] = 0x0f;
    for (let i = 0; i < 4; i++) m.mem8[LFO + i] = 0x0f;
  };
  assert.ok(ramDiff(oracle, noOp, request()), "the request-ignoring no-op escaped (RAM)");
  assert.equal(ramDiff(oracle, noRotate, request()), null, "sanity: no-rotate matches on RAM only");
  assert.notDeepEqual(lfoAfter(noRotate, request()), lfoAfter(oracle, request()), "the no-rotate twin escaped (io)");
  assert.ok(ramDiff(oracle, noOp, decay()), "the decay-ignoring no-op escaped (RAM)");
  console.log("  TEETH: request no-op (RAM), no-rotate (io), decay no-op (RAM) all caught");
});
