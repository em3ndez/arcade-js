// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9fc4 (ROM 0x9fc4-0xa027) -- slot x column-approach step. Dissolves the
// jsr $a028 (new-column pick) into the idiomatic loc_a028. All output is RAM, so each arm compares the
// RAM diff (minus the dead stack). The far-limit arms enter loc_a028, which reads POKEY2 RANDOM
// ($60da); both sides run on identically-seeded Machines (same poly state) so the read agrees --
// CAPTURE + identical-seed is the equivalence guarantee there. An omitted-ret rewrite. A at RTS incidental.
// Run: node --test games/tempest/idiomatic/test/equivalence-9fc4.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9fc4 as oracle } from "../../translated/loc_9fc4.js";
import { loc_9fc4 } from "../loc_9fc4.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_10c, loc_111, loc_2b9, loc_3ac, loc_2df, loc_39a, loc_28a, loc_283, loc_3ab } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9fc4;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

const X = 0x02;
const COL = 0x05;
function seat(m, s = {}) {
  m.regs.x = s.x ?? X;
  m.mem.write8(loc_10c, s.c10c ?? 0x55);                 // distinct from 1 so the =1 store is observable
  m.mem.write8(loc_111, s.gate ?? 0x00);
  m.mem.write8((loc_2b9 + (s.x ?? X)) & 0xffff, s.col ?? COL);
  m.mem.write8((loc_3ac + (s.col ?? COL)) & 0xffff, s.colDepth ?? 0x40);
  m.mem.write8((loc_2df + (s.x ?? X)) & 0xffff, s.depth ?? 0x50);
  m.mem.write8((loc_39a + (s.col ?? COL)) & 0xffff, s.c39a ?? 0x00);
  m.mem.write8((loc_28a + (s.x ?? X)) & 0xffff, s.c28a ?? 0x00);
  m.mem.write8((loc_283 + (s.x ?? X)) & 0xffff, s.c283 ?? 0x00);
  m.mem.write8(loc_3ab, s.c3ab ?? 0x00);
}

test("CAPTURE: real 0x9fc4 dispatches -- loc_9fc4 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_9fc4(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: seeded states across every branch == oracle (RAM)", () => {
  const cases = [
    { tag: "shallow (<0x20) -> flag+clamp", depth: 0x10, colDepth: 0x40 },
    { tag: "mid-range, new min tags $039a", depth: 0x30, colDepth: 0x40 },
    { tag: "mid-range, not a new min", depth: 0x60, colDepth: 0x40 },
    { tag: "empty column seeded to 0xf1", depth: 0x30, colDepth: 0x00 },
    { tag: "far (>=0xf2), $03ab!=0 -> pick+park only", depth: 0xf5, colDepth: 0x40, c3ab: 0x01 },
    { tag: "far (>=0xf2), $03ab==0 -> full rewrite", depth: 0xff, colDepth: 0x40, c3ab: 0x00 },
    { tag: "far, gate on (col 0x0f skipped in pick)", depth: 0xff, colDepth: 0x40, c3ab: 0x00, gate: 0x01 },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seat(o, s);
    const c = new Machine(ROM, OPTS); seat(c, s);
    oracle(o); loc_9fc4(c);
    assert.equal(ramDiff(o, c), null, s.tag);            // POKEY read agrees: identical seed => identical poly
    const cleared = (s.depth ?? 0x50) >= 0xf2 && (s.c3ab ?? 0x00) === 0x00; // full-rewrite path clears $010c
    assert.equal(c.mem.read8(loc_10c), cleared ? 0x00 : 0x01, `${s.tag}: $010c`);
  }
});

test("TEETH: a twin that skips the $010c:=1 store diverges from the oracle", () => {
  const s = { depth: 0x10, c10c: 0x55 };
  const o = new Machine(ROM, OPTS); seat(o, s);
  const c = new Machine(ROM, OPTS); seat(c, s);
  oracle(o);
  // BUG: shallow path that flags+clamps but never sets $010c:=1.
  const broken = (m) => {
    const { mem8 } = m;
    const col = mem8[(loc_2b9 + X) & 0xffff];
    const colAddr = (loc_3ac + col) & 0xffff;
    if (mem8[colAddr] === 0) mem8[colAddr] = 0xf1;
    const depthAddr = (loc_2df + X) & 0xffff;
    if (mem8[depthAddr] < mem8[colAddr]) { mem8[colAddr] = mem8[depthAddr]; mem8[(loc_39a + col) & 0xffff] = 0x80; }
    mem8[(loc_28a + X) & 0xffff] |= 0x80;
    mem8[depthAddr] = 0x20;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the skipped $010c store");
});

test("SP-TOOTH: the omitted-ret rewrite is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seat(m, { depth: 0x10 });   // shallow path: no POKEY, deterministic
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_9fc4, TARGET, m);
  assert.equal(r.placeable, true, `loc_9fc4 must be seam-placeable; got: ${r.error}`);
});
