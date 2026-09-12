// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b69b (ROM 0xb69b-0xb6f7) -- builds a screen position for slot X and tail-jmps
// the vector emitter (df59). Loads $02df,x -> $57 and the ($02b9,x)-indexed pair $03ce/$03de -> $56/$58;
// when the phase byte $02cc,x is negative it interpolates each toward the next segment via loc_b6fa; then
// folds the deltas (c098), lays the header (c765, X=0x61), appends a (mantissa,exponent) pair (bd3e) and
// draws (df59). REGISTER-THREAD DISSOLVE: bd3e now RETURNS its exit Y (= $a9 + 2); the ROM leaves that Y
// in place and consumes it with `sty $a9`, so the module captures the return and PERSISTS it to $a9, then
// reloads df59's cursor offset from that $a9 -- threading bd3e's return, not the pre-call $a9 (=0). The
// threaded register is verified in RAM ($a9 + the downstream cursor $74 / vector-list stores); the TEETH
// arm proves that threading the WRONG register (the stale pre-bd3e $a9) diverges there.
// Live-out is memory only (b69b tail-jmps df59, whose product is the vector list + cursor), so each arm
// runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH). The coprocessor is
// instantaneous and deterministic, so identical seeds yield identical reads on both arms.
// Run: node --test games/tempest/idiomatic/test/equivalence-b69b.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b69b as oracle } from "../../translated/loc_b69b.js";
import { loc_b69b } from "../loc_b69b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { loc_b6fa } from "../loc_b6fa.js";
import { loc_c098 } from "../loc_c098.js";
import { loc_c765 } from "../loc_c765.js";
import { loc_bd3e } from "../loc_bd3e.js";
import { loc_df59 } from "../loc_df59.js";
import {
  STACK_SCRATCH, loc_3, loc_56, loc_57, loc_58, loc_a9,
  loc_2b9, loc_2cc, loc_2df, loc_3ce, loc_3de, loc_cec8, loc_cec9,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb69b;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 8000) : [];

// Non-default seed: slot 0 with phase bit7 SET (0x85 -> fraction 5) so the interpolation branch runs,
// a coord and distinct seg/next segment endpoints, the cursor $74/$75 aimed into vector RAM (0x2800),
// and the c098/bd3e math-box operands. Both arms get identical seeds, so any RAM divergence is a real
// behavioural difference (not a seed artifact).
function seedInterp(m) {
  m.regs.x = 0;
  m.mem.write8(loc_2df, 0x40);              // slot coord -> $57
  m.mem.write8(loc_2b9, 0x03);              // segment index (Y)
  m.mem.write8(loc_2cc, 0x85);             // phase: bit7 set, low bits = fraction 5
  m.mem.write8((loc_3ce + 3) & 0xffff, 0x40); // $03ce[seg]
  m.mem.write8((loc_3de + 3) & 0xffff, 0x50); // $03de[seg]
  m.mem.write8((loc_3ce + 4) & 0xffff, 0x60); // $03ce[next]
  m.mem.write8((loc_3de + 4) & 0xffff, 0x30); // $03de[next]
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x28); // cursor -> 0x2800 (vector RAM)
  m.mem.write8(0x5b, 0x00); m.mem.write8(0x5e, 0x30); m.mem.write8(0x5f, 0x10); m.mem.write8(0x60, 0x20);
  m.mem.write8(0x66, 0x03); m.mem.write8(0x67, 0x00); m.mem.write8(0x68, 0x05); m.mem.write8(0x69, 0x00);
  m.mem.write8(0xa0, 0x08);                 // bd3e exponent operand
  m.mem.write8(loc_3, 0x02);                // $03 -> cec8/cec9 table index
}
function seedNoInterp(m) { seedInterp(m); m.mem.write8(loc_2cc, 0x05); } // phase bit7 CLEAR -> no interpolation

test("CAPTURE: real 0xb69b dispatches -- loc_b69b == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b69b(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED (interpolation): phase bit7 set -- loc_b69b == oracle, $56/$58 interpolate and Y threads to $a9", () => {
  const o = new Machine(ROM, OPTS); seedInterp(o);
  const c = new Machine(ROM, OPTS); seedInterp(c);
  oracle(o); loc_b69b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after run (interpolation path)");
  assert.notEqual(c.mem.read8(loc_56), 0x40, "interpolation moved $56 off its direct seg value");
  assert.equal(c.mem.read8(loc_56), o.mem.read8(loc_56), "$56 matches oracle");
  assert.equal(c.mem.read8(loc_58), o.mem.read8(loc_58), "$58 matches oracle");
  assert.equal(c.mem.read8(loc_a9), 0x02, "bd3e exit Y (= seeded $a9 0 + 2) persisted to $a9");
});

test("CRAFTED (no interpolation): phase bit7 clear -- direct seg values, RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedNoInterp(o);
  const c = new Machine(ROM, OPTS); seedNoInterp(c);
  oracle(o); loc_b69b(c);
  assert.equal(ramDiff(o, c), null, "RAM equal (no-interpolation path)");
  assert.equal(c.mem.read8(loc_56), 0x40, "$56 is the direct seg value (no interpolation)");
  assert.equal(c.mem.read8(loc_58), 0x50, "$58 is the direct seg value (no interpolation)");
});

test("TEETH (register thread): a twin that discards bd3e's return (stale $a9) diverges in $a9 + cursor", () => {
  const o = new Machine(ROM, OPTS); seedInterp(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedInterp(c);
  // Faithful head, but the register thread is BROKEN: bd3e's returned Y is discarded so $a9 keeps its
  // pre-call 0, and df59's cursor offset reloads that stale 0 instead of the extended callee's exit Y.
  const wrongThread = (m, x = m.regs.x) => {
    const { mem8 } = m;
    mem8[loc_57] = mem8[u16(loc_2df + x)];
    const seg = mem8[u16(loc_2b9 + x)];
    mem8[loc_56] = mem8[u16(loc_3ce + seg)];
    mem8[loc_58] = mem8[u16(loc_3de + seg)];
    const phase = mem8[u16(loc_2cc + x)];
    if (phase & 0x80) {
      const next = (seg + 1) & 0x0f;
      let d0 = (mem8[u16(loc_3ce + next)] - mem8[loc_56]) & 0xff;
      d0 = loc_b6fa(m, d0, x); mem8[loc_56] = (d0 + mem8[loc_56]) & 0xff;
      let d1 = (mem8[u16(loc_3de + next)] - mem8[loc_58]) & 0xff;
      d1 = loc_b6fa(m, d1, x); mem8[loc_58] = (d1 + mem8[loc_58]) & 0xff;
    }
    loc_c098(m);
    loc_c765(m, 0x61);
    mem8[loc_a9] = 0x00;
    loc_bd3e(m); // BUG: return discarded, $a9 left at the stale 0
    const idx = (((mem8[loc_3] & 0x03) << 1) + 0x4e) & 0xff;
    const a = mem8[u16(loc_cec8 + idx)];
    const hx = mem8[u16(loc_cec9 + idx)];
    const y = mem8[loc_a9]; // = 0 (stale), NOT the threaded exit Y (= 2)
    return loc_df59(m, a, hx, y);
  };
  wrongThread(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong (stale) register thread");
  assert.notEqual(c.mem.read8(loc_a9), o.mem.read8(loc_a9), "$a9 (the persistently-stashed cell) must diverge");
});

test("TEETH (mutation): a twin that skips interpolation when phase bit7 is set diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedInterp(o); oracle(o);
  const c = new Machine(ROM, OPTS); seedInterp(c);
  const noInterpTwin = (m, x = m.regs.x) => {
    const { mem8 } = m;
    mem8[loc_57] = mem8[u16(loc_2df + x)];
    const seg = mem8[u16(loc_2b9 + x)];
    mem8[loc_56] = mem8[u16(loc_3ce + seg)];
    mem8[loc_58] = mem8[u16(loc_3de + seg)];
    // BUG: never interpolates, even though phase bit7 is set.
    loc_c098(m);
    loc_c765(m, 0x61);
    mem8[loc_a9] = 0x00;
    const yExit = loc_bd3e(m);
    mem8[loc_a9] = yExit;
    const idx = (((mem8[loc_3] & 0x03) << 1) + 0x4e) & 0xff;
    const a = mem8[u16(loc_cec8 + idx)];
    const hx = mem8[u16(loc_cec9 + idx)];
    const y = mem8[loc_a9];
    return loc_df59(m, a, hx, y);
  };
  noInterpTwin(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped interpolation");
});

test("SP-TOOTH: the omitted-ret dissolve (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedInterp(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_b69b, TARGET, m);
  assert.equal(r.placeable, true, `loc_b69b must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret dissolve (moved 0) placeable");
});
