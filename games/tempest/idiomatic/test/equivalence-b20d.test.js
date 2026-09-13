// SPDX-License-Identifier: GPL-3.0-only
// Equivalence for loc_b20d (ROM 0xb20d-0xb217) -- an RTS-trampoline computed-jump dispatcher: it reads the
// pre-doubled selector in loc_1, pushes word(0xb218+sel)(target-1), and rts-dispatches to target. The word
// table at 0xb218 holds twelve entries; the idiomatic form dissolves the trick into TABLE[loc_1>>1](m).
// Contract: RAM (dumpState minus STACK_SCRATCH). A dispatching rewrite -> SP-tooth (seamPlaceable). Some
// targets reach the clock-coupled POKEY RANDOM, so CAPTURE freezes it on both clones.
// Run: node --test games/tempest/idiomatic/test/equivalence-b20d.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b20d as oracle } from "../../translated/loc_b20d.js";
import { loc_b20d } from "../loc_b20d.js";
import { loc_b230 } from "../loc_b230.js";
import { loc_d804 } from "../loc_d804.js";
import { loc_b8ba } from "../loc_b8ba.js";
import { loc_adea } from "../loc_adea.js";
import { loc_af81 } from "../loc_af81.js";
import { loc_ae1c } from "../loc_ae1c.js";
import { loc_aa62 } from "../loc_aa62.js";
import { loc_aa5a } from "../loc_aa5a.js";
import { loc_aa6f } from "../loc_aa6f.js";
import { loc_b102 } from "../loc_b102.js";
import { loc_b131 } from "../loc_b131.js";
import { loc_aa79 } from "../loc_aa79.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_1 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb20d;
const TABLE = [loc_b230, loc_d804, loc_b8ba, loc_adea, loc_af81, loc_ae1c, loc_aa62, loc_aa5a, loc_aa6f, loc_b102, loc_b131, loc_aa79];
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) => firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
const freezePokey = (m) => { for (const p of m.io.pokeys) p.skctl &= ~0x03; return m; };

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0xb20d dispatches -- loc_b20d == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = freezePokey(cap.clone()), c = freezePokey(cap.clone());
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    loc_b20d(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} compared`);
});

test("CRAFTED: each of the twelve entries -> loc_b20d == oracle in RAM; skip on oracle throw", () => {
  let checked = 0;
  for (let i = 0; i < TABLE.length; i++) {
    const o = freezePokey(new Machine(ROM, OPTS)); o.mem.write8(loc_1, i * 2);
    const c = freezePokey(new Machine(ROM, OPTS)); c.mem.write8(loc_1, i * 2);
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    loc_b20d(c);
    assert.equal(ramDiff(o, c), null, `RAM equal dispatching entry ${i}`);
    checked++;
  }
  console.log(`  CRAFTED: ${checked}/${TABLE.length} entries provisioned and checked`);
  assert.ok(checked >= 1, "no entry could be provisioned -- seed is inert");
});

test("TEETH: a twin that dispatches the WRONG entry (idx^1) diverges in RAM", () => {
  // Driven from real captured states (provisioned) -- the correct target runs cleanly; the flipped one
  // must reach a different RAM outcome on at least one state.
  let caught = false, tried = 0;
  for (const cap of CAPS) {
    const idx = cap.mem.read8(loc_1) >> 1;
    const flipped = idx ^ 1;
    if (idx >= TABLE.length || flipped >= TABLE.length) continue;
    const o = freezePokey(cap.clone());
    let threw = false;
    try { oracle(o); } catch { threw = true; }
    if (threw) continue;
    const c = freezePokey(cap.clone());
    let brokeThrew = false;
    try { TABLE[flipped](c); } catch { brokeThrew = true; }
    if (brokeThrew) continue;
    tried++;
    if (ramDiff(o, c) !== null) { caught = true; break; }
  }
  assert.ok(tried > 0, "no captured state could be exercised for the teeth arm");
  assert.ok(caught, "the RAM diff FAILED to catch a wrong-entry dispatch on every exercised state");
});

test("SP-TOOTH: the omitted-ret dispatcher is seam-placeable", () => {
  let placed = false, lastErr = "no provisioned capture";
  for (const cap of CAPS) {
    const m = freezePokey(cap.clone());
    m.regs.s = 0xfb;
    m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
    const r = seamPlaceable(withOmittedRet, loc_b20d, TARGET, m);
    if (r.placeable) { placed = true; break; }
    lastErr = r.error;
  }
  assert.equal(placed, true, `loc_b20d must be seam-placeable on some captured state; last: ${lastErr}`);
});
