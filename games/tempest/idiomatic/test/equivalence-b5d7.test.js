// SPDX-License-Identifier: GPL-3.0-only
// Equivalence for loc_b5d7 (ROM 0xb5d7-0xb5e0) -- an RTS-trick COMPUTED-JUMP dispatcher: it does tay (Y=A)
// then pushes word($b5e1+Y) and rts, jumping to (word+1). The caller passes A as a byte offset (0,2,4,6,8)
// into the 2-byte jump table at $b5e1; the five targets (word+1) are 0xb5eb/0xb71b/0xb60f/0xb622/0xb69b and
// each RTS returns to loc_b5d7's own caller. The idiomatic form dissolves the push/pull16/rts-jump into
// TABLE[a>>1](m). All five targets take only (m, x=m.regs.x) -- none reads Y -- so the tay is a dead
// register and the contract is RAM (dumpState, minus STACK_SCRATCH); the oracle's stack gymnastics land in
// STACK_SCRATCH and are excluded.
// Run: node --test games/tempest/idiomatic/test/equivalence-b5d7.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b5d7 as oracle } from "../../translated/loc_b5d7.js";
import { loc_b5d7 } from "../loc_b5d7.js";
import { loc_b5eb } from "../loc_b5eb.js";
import { loc_b71b } from "../loc_b71b.js";
import { loc_b60f } from "../loc_b60f.js";
import { loc_b622 } from "../loc_b622.js";
import { loc_b69b } from "../loc_b69b.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { STACK_SCRATCH, loc_74, loc_75, loc_ac, loc_ad } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb5d7;
const TABLE = [loc_b5eb, loc_b71b, loc_b60f, loc_b622, loc_b69b];
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

// Point the draw pipeline at mapped RAM so the targets' (loc_ac)->list->(loc_74) chases land in vector RAM
// and a slot index is valid, then aim A at a table entry.
function seed(m, a) {
  m.regs.a = a; m.regs.x = 0x00;
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x28); // cursor into vector RAM 0x2800
  m.mem.write8(loc_ac, 0x00); m.mem.write8(loc_ad, 0x04); // (loc_ac) -> object pointer table at 0x0400
  for (let i = 0; i < 0x20; i++) m.mem.write8(u16(0x0400 + i), 0x20); // every slot -> a list at 0x0420
  m.mem.write8(0x0420, 0x80); // one bit7-terminated list entry
}

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0xb5d7 dispatches -- loc_b5d7 == oracle in RAM (-stack)", () => {
  const as = new Set();
  for (const cap of CAPS) {
    as.add(cap.regs.a);
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b5d7(c);
    assert.equal(ramDiff(o, c), null, `RAM equal for captured A=${cap.regs.a}`);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked; distinct A seen: [${[...as].sort((a, b) => a - b).join(",")}]`);
});

test("CRAFTED: each table entry A=0,2,4,6,8 -- loc_b5d7 == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const a of [0, 2, 4, 6, 8]) {
    const o = new Machine(ROM, OPTS); seed(o, a);
    const c = new Machine(ROM, OPTS); seed(c, a);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue; // an entry the generic seed cannot fully provision -- CAPTURE + others carry it
    loc_b5d7(c);
    assert.equal(ramDiff(o, c), null, `RAM equal after dispatching entry A=${a}`);
    checked++;
  }
  console.log(`  CRAFTED: ${checked}/5 entries provisioned and checked`);
  assert.ok(checked >= 1, "no entry could be provisioned -- seed is inert");
});

test("TEETH: a twin that dispatches the WRONG entry (a>>1)^1 diverges in RAM", () => {
  // Find an A whose real vs flipped entry both provision cleanly and actually differ.
  let caught = false, tried = 0;
  for (const a of [0, 2, 4, 6, 8]) {
    const o = new Machine(ROM, OPTS); seed(o, a);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    const c = new Machine(ROM, OPTS); seed(c, a);
    const idx = a >> 1, flipped = idx ^ 1;
    if (flipped >= TABLE.length) continue;
    let brokeThrew = false;
    try { TABLE[flipped](c); } catch { brokeThrew = true; }
    if (brokeThrew) continue;
    tried++;
    if (ramDiff(o, c) !== null) { caught = true; break; }
  }
  assert.ok(tried > 0, "no entry pair could be exercised for the teeth arm");
  assert.ok(caught, "the RAM diff FAILED to catch a wrong-entry dispatch on every exercised pair");
});

test("SP-TOOTH: the omitted-ret dispatcher (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seed(m, 0x00);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12); // a real caller-return word for the seam
  const r = seamPlaceable(withOmittedRet, loc_b5d7, TARGET, m);
  assert.equal(r.placeable, true, `loc_b5d7 must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret dispatcher (moved 0) placeable");
});
