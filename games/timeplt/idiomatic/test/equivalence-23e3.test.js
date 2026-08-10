// SPDX-License-Identifier: GPL-3.0-only
/**
 * fireAndSweepPlayerShots — memory-equivalent to the frozen oracle at ROM 0x23e3.
 * GATE: masked-diff. The dissolved tail return drops the frozen side's push/ret, so [low, seat) is
 * masked and the two-byte drift asserted. Real dispatches idle (footprint zero), so crafted entries
 * force the spawn, table-full, integrate and cull paths; a scribble control keeps the idle arm honest.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-23e3.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { u8, u16 } from "../../../../core/int.js";
import { fireAndSweepPlayerShots } from "../fireAndSweepPlayerShots.js";
import { loc_23e3 as oracle } from "../../translated/loc_23e3.js";
import { queueTileStampForObject } from "../queueTileStampForObject.js";

const TARGET = 0x23e3;
const DATA_TOP = 0xaeff;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLAYER_STATE = 0xa800, SPAWN_INHIBIT = 0xacc6, PHASE = 0xa98e, ARMED = 0xaa81,
  COOLDOWN = 0xaa82, BANK = 0xaa80, PLAY_ACTIVE = 0xad30, STRIDE = 16;
const SCROLL_Y = 0xa808, SCROLL_X = 0xa80a;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let real = null;
function captureReal() {
  if (real) return real;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  assert.ok(entries.length > 0, "vacuous: nothing dispatched this address");
  real = entries;
  return real;
}

function base() {
  const r = captureReal();
  return (r.find((e) => e.mem8[PLAYER_STATE] === 0xff) ?? r[0]);
}
function craft(mut) { const e = base().clone(); mut(e); return e; }

// Each forces one exit of the routine while leaving the rest of the captured machine real.
const CRAFTS = {
  spawn: () => craft((e) => {
    e.mem8[PLAYER_STATE] = 0xff; e.mem8[SPAWN_INHIBIT] = 0; e.mem8[PHASE] = 1;
    e.mem8[ARMED] = 2; e.mem8[PLAY_ACTIVE] = 1; e.mem8[COOLDOWN] = 0; e.mem8[BANK] = 0;
  }),
  tableFull: () => craft((e) => {
    e.mem8[PLAYER_STATE] = 0xff; e.mem8[SPAWN_INHIBIT] = 0; e.mem8[ARMED] = 2;
    e.mem8[PLAY_ACTIVE] = 1; e.mem8[COOLDOWN] = 0;
    for (let i = 0; i < 6; i++) e.mem8[BANK + i * STRIDE] = 0x55;
  }),
  integrate: () => craft((e) => {
    e.mem8[PLAYER_STATE] = 0; e.mem8[BANK] = 0xff;
    e.mem8[BANK + 3] = 0x10; e.mem8[BANK + 4] = 0x40; e.mem8[BANK + 5] = 0x10; e.mem8[BANK + 6] = 0x40;
    e.mem8[BANK + 10] = 0; e.mem8[BANK + 11] = 1; e.mem8[BANK + 12] = 0; e.mem8[BANK + 13] = 1;
    e.mem8[COOLDOWN] = 3;
  }),
  cull: () => craft((e) => {
    e.mem8[PLAYER_STATE] = 0; e.mem8[BANK] = 0x55; e.mem8[BANK + 4] = 0x99; e.mem8[BANK + 6] = 0x99;
  }),
};

// oracle vs candidate on independent clones, with the frozen side's stack scratch [low, seat) masked.
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const seat = a.regs.sp; let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  const b = machine.clone();
  try { candidate(b); } catch (e) { return { addr: null, a: "returned", b: String(e).slice(0, 40) }; }
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

function maskProbe(machine) {
  const a = machine.clone();
  const seat = a.regs.sp; let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  const b = machine.clone(); fireAndSweepPlayerShots(b);
  return { low, seat, spDiff: a.regs.sp - b.regs.sp };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone(); oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────
function brokenNoOp() {}
function brokenWrongCooldown(m) { fireAndSweepPlayerShots(m); m.mem8[COOLDOWN] = u8(m.mem8[COOLDOWN] + 1); }
function brokenWrongSlotHead(m) { fireAndSweepPlayerShots(m); m.mem8[BANK] = u8(m.mem8[BANK] + 1); }
function brokenNeverCull(m) {
  const { mem8, mem16 } = m;
  if (mem8[COOLDOWN] !== 0) mem8[COOLDOWN] = u8(mem8[COOLDOWN] - 1);
  for (let i = 0; i < 6; i++) {
    const slot = BANK + i * STRIDE;
    const head = mem8[slot];
    if (head === 0) continue;
    if (u8(head + 1) !== 0) continue; // BUG: a stale head is left in place instead of culled
    const x = u16(u16(mem16[slot + 10] + mem16[SCROLL_Y]) + mem16[slot + 3]);
    if (u8((x >> 8) + 0x10) < 0x10) continue; // BUG: an off-field slot survives
    mem16[slot + 3] = x;
    const y = u16(u16(mem16[slot + 12] + mem16[SCROLL_X]) + mem16[slot + 5]);
    if (u8((y >> 8) + 0x08) < 0x18) continue; // BUG: an off-field slot survives
    mem16[slot + 5] = y;
    queueTileStampForObject(m, slot);
  }
}

// ── the gate ────────────────────────────────────────────────────────────────
test("REAL DISPATCHES: every captured entry identical, with a scribble control", { skip }, () => {
  const entries = captureReal();
  for (const e of entries) assert.equal(unitDiff(fireAndSweepPlayerShots, e), null, "a real dispatch diverged");
  const caught = entries.filter((e) => unitDiff(brokenWrongCooldown, e)).length;
  assert.ok(caught > 0, "the scribble twin passed every real entry, so this arm proves nothing");
  console.log(`  REAL: ${entries.length} identical; scribble control caught on ${caught}`);
});

test("CRAFTED PATHS: spawn, table-full, integrate and cull identical and non-vacuous", { skip }, () => {
  for (const [name, make] of Object.entries(CRAFTS)) {
    const e = make();
    assert.equal(unitDiff(fireAndSweepPlayerShots, e), null, `${name} diverged`);
    const fp = footprint(e);
    assert.ok(fp > 0, `${name} moves no memory, so its comparison is vacuous`);
    console.log(`  CRAFTED ${name}: identical, oracle moves ${fp} bytes`);
  }
});

test("SP AND SCRATCH: two-byte drift and a mask floor above the data", { skip }, () => {
  for (const name of ["spawn", "cull"]) {
    const r = maskProbe(CRAFTS[name]());
    assert.equal(r.spDiff, 2, `${name}: the dropped tail return no longer drifts two bytes (${r.spDiff})`);
    assert.ok(r.low > DATA_TOP, `${name}: the mask floor ${hex4(r.low)} reached into game data`);
  }
  const r = maskProbe(CRAFTS.spawn());
  console.log(`  SP AND SCRATCH: spDiff ${r.spDiff}; deepest push ${hex4(r.low)} over the spawn path`);
});

const TWINS = [
  ["no-op", brokenNoOp],
  ["wrong-cooldown", brokenWrongCooldown],
  ["wrong-slot-head", brokenWrongSlotHead],
  ["never-cull", brokenNeverCull],
];
for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const hits = Object.entries(CRAFTS).filter(([, make]) => unitDiff(twin, make()));
    assert.ok(hits.length > 0, `every crafted path PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${hits.map(([n]) => n).join(", ")}`);
  });
}
