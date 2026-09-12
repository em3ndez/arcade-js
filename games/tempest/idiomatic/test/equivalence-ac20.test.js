// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_ac20 (ROM 0xac20-0xac35) -- refreshes the live control snapshot via d6bb,
// then either falls into loc_ac36 (set the low two $01c9 request bits) or into the shared rts loc_ac3e
// (no change). Dissolves all three m.calls into direct idiomatic calls. The oracle m.calls the frozen
// d6bb/ac36/ac3e; the idiomatic calls the idiomatic ones. All output is RAM (d6bb's writes + $01c9), so
// each arm compares the RAM diff (minus the dead stack). An omitted-ret rewrite. A/X/Y at RTS incidental.
// Run: node --test games/tempest/idiomatic/test/equivalence-ac20.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_ac20 as oracle } from "../../translated/loc_ac20.js";
import { loc_ac20 } from "../loc_ac20.js";
import { loc_d6bb } from "../loc_d6bb.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, loc_71e, loc_71f, loc_1c9 } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xac20;
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

// d6bb reads $0e00 (DSW2, a read-only port -- seed via m.io.dsw2, not a RAM write) into $0a, and folds
// $016a from the POKEY ALLPOT reads (unseeded -> 0, so $016a & 3 == 0). The two ac20 compares are then
// steered by the latch cells $071e (vs $0a & 0xf8) and $071f (vs $016a & 3 == 0), both work RAM. Seed
// $01c9 so an ac36 request write is observable.
function seat(m, s = {}) {
  m.io.dsw2 = s.dsw2 ?? 0x00;
  m.mem.write8(loc_71e, s.t71e ?? 0x00);
  m.mem.write8(loc_71f, s.t71f ?? 0x00);
  m.mem.write8(loc_1c9, s.c1c9 ?? 0x00);
}

test("CAPTURE: real 0xac20 dispatches -- loc_ac20 == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_ac20(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: match (no change) and mismatch (set $01c9) == oracle (RAM)", () => {
  const cases = [
    { tag: "both match -> shared rts, $01c9 unchanged", dsw2: 0x00, t71e: 0x00, t71f: 0x00, c1c9: 0x00 },
    { tag: "hi mismatch -> ac36 sets $01c9", dsw2: 0x00, t71e: 0xf8, t71f: 0x00, c1c9: 0x00 },
    { tag: "lo mismatch -> ac36 sets $01c9", dsw2: 0x00, t71e: 0x00, t71f: 0x01, c1c9: 0x00 },
  ];
  for (const s of cases) {
    const o = new Machine(ROM, OPTS); seat(o, s);
    const c = new Machine(ROM, OPTS); seat(c, s);
    oracle(o); loc_ac20(c);
    assert.equal(ramDiff(o, c), null, s.tag);
  }
});

test("TEETH: a twin that always requests a rebuild diverges on the match case", () => {
  const s = { dsw2: 0x00, t71e: 0x00, t71f: 0x00, c1c9: 0x00 };
  const o = new Machine(ROM, OPTS); seat(o, s);
  const c = new Machine(ROM, OPTS); seat(c, s);
  oracle(o);
  // BUG: ignores the compare and always sets the $01c9 request bits (skips the ac3e no-change path).
  const broken = (m) => {
    const { mem8 } = m;
    loc_d6bb(m);
    mem8[loc_1c9] |= 0x03;
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the spurious $01c9 request");
});

test("SP-TOOTH: the omitted-ret rewrite is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  seat(m, { e00: 0x00, t71e: 0x00, t71f: 0x00 });
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_ac20, TARGET, m);
  assert.equal(r.placeable, true, `loc_ac20 must be seam-placeable; got: ${r.error}`);
});
