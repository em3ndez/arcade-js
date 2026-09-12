// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_b8ba -- resets accumulators/seeds, caches the base pointer pair, draws each
// active slot's record, and closes by swapping pointers and drawing the base list. The idiomatic side
// dissolves the jsr chain (df39/b967/c098/b944/c3ba/b56a/c772/b955/df6c/df4c/df4a/df6a/df09) into direct
// calls. Live-out is RAM, so each arm compares dumpState minus STACK_SCRATCH.
// Run: node --test games/tempest/idiomatic/test/equivalence-b8ba.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_b8ba as oracle } from "../../translated/loc_b8ba.js";
import { loc_b8ba } from "../loc_b8ba.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import {
  STACK_SCRATCH, loc_5b, loc_5f, loc_68, loc_69, loc_74, loc_75, loc_202, loc_283,
  loc_263, loc_2a3, loc_37, loc_56, loc_57, loc_58, loc_73, loc_76, loc_77, loc_9e,
} from "../names.js";
import { loc_df39 } from "../loc_df39.js";
import { loc_df4a } from "../loc_df4a.js";
import { loc_df4c } from "../loc_df4c.js";
import { loc_df6a } from "../loc_df6a.js";
import { loc_df6c } from "../loc_df6c.js";
import { loc_df09 } from "../loc_df09.js";
import { loc_b56a } from "../loc_b56a.js";
import { loc_b944 } from "../loc_b944.js";
import { loc_b955 } from "../loc_b955.js";
import { loc_b967 } from "../loc_b967.js";
import { loc_c098 } from "../loc_c098.js";
import { loc_c3ba } from "../loc_c3ba.js";
import { loc_c772 } from "../loc_c772.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xb8ba;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 2000) : [];

test("CAPTURE: real 0xb8ba dispatches -- loc_b8ba == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_b8ba(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// No active slots: exercises the reset/seed prologue, the pointer caching, and the close (pointer swap
// plus the base list draw) without entering the per-slot record body (which drives the coprocessor).
function seedEmpty(m) {
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x28); // cursor into vector RAM
  m.mem.write8(0x0076, 0x00); m.mem.write8(0x0077, 0x2c); // second pointer
  for (let i = 0; i <= 0x0f; i++) m.mem.write8(u16(loc_283 + i), 0x00); // no active slots
}

test("CRAFTED: no active slots -- prologue and close match the oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedEmpty(o);
  const c = new Machine(ROM, OPTS); seedEmpty(c);
  oracle(o); loc_b8ba(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after empty frame");
  assert.equal(c.mem.read8(loc_5f), 0xe0, "seed $5f");
  assert.equal(c.mem.read8(loc_5b), 0xff, "seed $5b");
  assert.equal(c.mem.read8(loc_202), 0x00, "cleared $0202");
  assert.equal(c.mem.read8(loc_68), 0x00, "cleared $68");
  assert.equal(c.mem.read8(loc_69), 0x00, "cleared $69");
});

test("TEETH: a twin that skips the seed writes diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedEmpty(o);
  const c = new Machine(ROM, OPTS); seedEmpty(c);
  oracle(o);
  const brokenB8ba = (_m) => { /* BUG: never resets accumulators, never draws, never closes */ };
  brokenB8ba(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the missing reset/close");
});

// One active slot (x=0): drives the per-slot record body (integrate + emit) that the empty seed skips,
// so the whole dissolve chain (c098/b944/c3ba/b56a/c772/b955->df6c/df4c/df4a/b967->df39) is exercised
// against the oracle. Cursor + second pointer aim at vector RAM so the emitted records land in the diff.
function seedActive(m) {
  m.mem.write8(loc_74, 0x00); m.mem.write8(loc_75, 0x28); // cursor into vector RAM
  m.mem.write8(loc_76, 0x00); m.mem.write8(loc_77, 0x2c); // second pointer
  for (let i = 0; i <= 0x0f; i++) m.mem.write8(u16(loc_283 + i), 0x00);
  m.mem.write8(u16(loc_283 + 0), 0x01);  // slot 0 active
  m.mem.write8(u16(loc_263 + 0), 0x40);  // its delta bytes (distinct)
  m.mem.write8(u16(loc_2a3 + 0), 0x30);
}

test("CRAFTED: one active slot -- per-slot record body marshalling matches the oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); seedActive(o);
  const c = new Machine(ROM, OPTS); seedActive(c);
  oracle(o); loc_b8ba(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after one active slot's record is emitted");
});

// A twin whose per-slot body is byte-identical EXCEPT the loc_b56a shadow-header arg (0xa0 -> 0x00) --
// a marshalling mutation. It MUST diverge, proving the active-slot arm actually verifies the body
// (not a vacuous pass over a skipped body).
function brokenMarshal(m) {
  const { mem8 } = m;
  loc_df39(m, 0x3f, 0xf2);
  mem8[0x6a] = 0x00; mem8[0x6b] = 0x00; mem8[0x6c] = 0x00; mem8[0x6d] = 0x00;
  mem8[loc_202] = 0x00; mem8[loc_68] = 0x00; mem8[loc_69] = 0x00;
  mem8[loc_5f] = 0xe0; mem8[loc_5b] = 0xff;
  { const [a, x] = loc_b967(m); mem8[loc_77] = a; mem8[loc_76] = x; }
  mem8[loc_37] = 0x0f;
  do {
    const x = mem8[loc_37];
    const active = mem8[u16(loc_283 + x)];
    if (active !== 0) {
      mem8[loc_57] = active;
      mem8[loc_56] = mem8[u16(loc_263 + x)];
      mem8[loc_58] = mem8[u16(loc_2a3 + x)];
      loc_c098(m);
      mem8[loc_73] = 0x00;
      loc_b944(m);
      loc_c3ba(m);
      loc_b56a(m, 0x00);          // BUG: shadow-header arg should be 0xa0
      loc_b944(m);
      loc_c772(m, 0x61);
      const [pa, py] = loc_b955(m);
      loc_df6c(m, pa, py);
      let phase = mem8[loc_37] & 0x07;
      if (phase === 0x07) phase = 0x00;
      mem8[loc_9e] = phase;
      loc_df4c(m, 0x08, phase);
      loc_df4a(m, 0x00);
      const [ha, hx] = loc_b967(m);
      loc_df39(m, ha, hx);
    }
    const next = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = next;
    if (next & 0x80) break;
  } while (true);
  loc_b944(m);
  loc_df6a(m, 0x01);
  loc_df09(m);
  loc_b944(m);
}

test("TEETH (marshalling): a twin with the wrong loc_b56a shadow arg diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); seedActive(o);
  const c = new Machine(ROM, OPTS); seedActive(c);
  oracle(o); brokenMarshal(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the wrong loc_b56a arg");
});

test("SP-TOOTH: the omitted-ret tail-caller (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS); seedEmpty(m);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, loc_b8ba, TARGET, m);
  assert.equal(r.placeable, true, `loc_b8ba must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret tail-caller (moved 0) placeable");
});
