// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0712 — memory-equivalent to the frozen oracle. Reads the mode bit (0x4006 bit 0) and stamps the
 * counter cell at HL (both callers pass HL=0x400a): 4 when the bit is set, 14 (0x0e) when clear; then
 * re-arms the dwell timer (0x4009=0x50). Two paths exercised on the mode bit. HL is seated at 0x400a,
 * matching the calling convention the dwell reload assumes. Live-out is work RAM only; the return-stack
 * window is masked. Teeth: no-op, wrong-marker, no-reload twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0712 as cand } from "../loc_0712.js";
import { loc_0712 as oracle } from "../../translated/loc_0712.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const MODE = 0x4006;      // bit 0 selects the marker
const COUNTER = 0x400a;   // HL target; gets the marker
const DWELL = 0x4009;     // re-armed to 0x50

// HL=0x400a is the live convention: the marker lands at 0x400a, the reload at 0x4009.
const modeClear = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.hl = COUNTER; mem[MODE] = 0x00; mem[COUNTER] = 0x00; mem[DWELL] = 0x00;
});
const modeSet = () => craft((mem, m) => {
  m.push16(0x9999); m.regs.hl = COUNTER; mem[MODE] = 0x01; mem[COUNTER] = 0x00; mem[DWELL] = 0x00;
});

const noOp = () => {};
const wrongMarker = (m) => { m.mem8[COUNTER] = 0x0e; m.mem8[DWELL] = 0x50; }; // swaps the set-bit marker
const noReload = (m) => { m.mem8[COUNTER] = (m.mem8[MODE] & 1) ? 4 : 14; };   // stamps but never re-arms

test("EQUAL (crafted): loc_0712 == oracle, mode bit clear -> marker 14", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, modeClear()), null, "loc_0712 diverged, mode clear");
  const a = modeClear(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTER], 0x0e, "positive control: marker 0x0e stamped");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: dwell re-armed to 0x50");
  console.log("  EQUAL: loc_0712 == oracle (RAM), mode clear -> marker 0x0e + dwell 0x50");
});

test("EQUAL (crafted): loc_0712 == oracle, mode bit set -> marker 4", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, modeSet()), null, "loc_0712 diverged, mode set");
  const a = modeSet(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTER], 0x04, "positive control: marker 0x04 stamped");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: dwell re-armed to 0x50");
  console.log("  EQUAL: loc_0712 == oracle (RAM), mode set -> marker 0x04 + dwell 0x50");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, modeSet()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongMarker, modeSet()), "the wrong-marker twin escaped");
  assert.ok(ramDiff(oracle, noReload, modeSet()), "the no-reload twin escaped");
  console.log("  TEETH: no-op, wrong-marker, no-reload all caught (RAM)");
});
