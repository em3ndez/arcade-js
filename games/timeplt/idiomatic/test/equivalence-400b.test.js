// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_400b — memory-equivalent to the frozen oracle at ROM 0x400B, the advance-step entry of the
 * object-bank sweep. REACHED: the coin-start tape dispatches this address (via serviceEra0BallisticObjectBank's empty-slot0
 * tail jump); the crafted sweep varies the two slots this entry reads, seated exactly as serviceEra0BallisticObjectBank
 * seats them. The oracle brackets services with pushed returns the rewrite never writes, so RAM is
 * compared with the dead stack scratch below the seat masked out, the SP drift asserted, registers
 * not compared, and teeth. Run: node --test games/timeplt/idiomatic/test/equivalence-400b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_400b as candidate } from "../loc_400b.js";
import { loc_400b as oracle } from "../../translated/loc_400b.js";
import { loc_3fea as seedOracle } from "../../translated/loc_3fea.js";
import { sweepObjectSlotBankServicingFirstSlot } from "../sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "../flyAlongBallisticArc.js";

const TARGET = 0x400b;
const SEED_SITE = 0x3fea;

const IX0 = 0xa8c0;
const IY0 = 0xaa28;
const COUNT = 3;
const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;
const LIVE = 0x50;
const HEADS = [EMPTY, BALLISTIC, LIVE];
// Advancing first, this entry reads slots 1 and 2; serviceEra0BallisticObjectBank has already consumed slot 0 as empty.
const READ_SLOTS = [1, 2];

const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** What serviceEra0BallisticObjectBank seats before jumping here. */
function seat(mm) {
  mm.regs.ix = IX0;
  mm.regs.iy = IY0;
  mm.regs.b = COUNT;
}

let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[SEED_SITE, (mm) => {
      if (entry === null) entry = mm.clone();
      return seedOracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

function craft(heads) {
  const m = entryState().clone();
  READ_SLOTS.forEach((slot, i) => { m.mem8[IX0 + slot * RECORD_STRIDE] = heads[i]; });
  return m;
}

function* combos() {
  for (const a of HEADS) for (const b of HEADS) {
    yield [[a, b].map(hex4).join(","), craft([a, b])];
  }
}

// Oracle vs candidate on independent clones, both seated. The oracle nests service calls and leaves
// dead return addresses in the stack scratch the rewrite never writes, so the diff excludes
// [low, seat) — low measured by watching the oracle's own pushes.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  seat(a);
  seat(b);
  const seatSp = a.regs.sp;
  let low = seatSp;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seatSp) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seatSp, spDiff: a.regs.sp - b.regs.sp };
}

function footprint(machine) {
  const a = machine.clone();
  seat(a);
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

function sweep(twin) {
  let caught = 0;
  for (const [, m] of combos()) if (compare(twin, m).escaped) caught++;
  return caught;
}

// ── twins: each a loc_400b with one deliberate defect; every knob matches the real one by default ──

function twin({ recStride = RECORD_STRIDE, sprStride = SPRITE_STRIDE, skipEmpty = true,
                ballistic = BALLISTIC, handoff = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    for (;;) {
      regs.ix = (regs.ix + recStride) & 0xffff;
      regs.iy = (regs.iy + sprStride) & 0xffff;
      regs.b = (regs.b - 1) & 0xff;
      if (regs.b === 0) return;
      const marker = mem8[regs.ix];
      if (skipEmpty && marker === EMPTY) continue;
      if (marker !== ballistic) { if (handoff) return sweepObjectSlotBankServicingFirstSlot(m); continue; }
      flyAlongBallisticArc(m);
    }
  };
}

const TWINS = [
  ["no-op", () => {}],
  ["record-stride-off", twin({ recStride: 0x08 })],
  ["sprite-stride-off", twin({ sprStride: 1 })],
  ["service-empty-slots", twin({ skipEmpty: false })],
  ["swap-routing", twin({ ballistic: LIVE })],
  ["no-handoff", twin({ handoff: false })],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("REACHED: the coin-start tape dispatches this address, attract does not, with a live control",
  { skip }, () => {
    const dispatched = {};
    for (const [label, opts] of [["coin-start", {}], ["attract", { tape: [] }]]) {
      const seen = { [TARGET]: 0, [SEED_SITE]: 0 };
      const m = makeMachine(new Map([[TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }]]), opts);
      const real = m.routines.get(SEED_SITE);
      m.routines.set(SEED_SITE, (mm) => { seen[SEED_SITE]++; return real(mm); });
      m.runFrames(ENTRY_FRAMES);
      assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
      // ★ Count means something only because the same tap saw the site that jumps here.
      assert.ok(seen[SEED_SITE] > 0, `${label}: the control tap fired nothing, so the count is blind`);
      dispatched[label] = seen[TARGET];
      console.log(`  REACHED: ${label} — ${hex4(TARGET)} ${seen[TARGET]}, control ${hex4(SEED_SITE)} ${seen[SEED_SITE]}`);
    }
    assert.ok(dispatched["coin-start"] > 0, "the playing tape never reached this entry");
    assert.equal(dispatched["attract"], 0, "attract now reaches this entry; the gate's split moved");
  });

test("SWEEP: every occupancy is memory-equivalent outside the masked stack scratch", { skip }, () => {
  assert.notEqual(entryState(), null, "vacuous: the tape never reached the seeding site");
  let worstLow = 0xffff;
  for (const [label, m] of combos()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops one return the rewrite does not`);
    worstLow = Math.min(worstLow, r.low);
  }
  // ★ The mask is safe only if its floor never reaches game data.
  assert.ok(worstLow > DATA_TOP, `the stack window ${hex4(worstLow)} reached into game data`);
  // ★ Vacuity guard: an all-empty read moves nothing here (no first-slot service), a ballistic pair does.
  assert.equal(footprint(craft([EMPTY, EMPTY])), 0, "an all-empty read moved data; the crafting lies");
  assert.notEqual(footprint(craft([BALLISTIC, BALLISTIC])), 0, "a ballistic pair moved nothing; pokes inert");
  console.log(`  SWEEP: ${[...combos()].length} occupancies identical; window floor ${hex4(worstLow)}`);
});

for (const [label, brokenTwin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on at least one occupancy`, { skip }, () => {
    const caught = sweep(brokenTwin);
    assert.ok(caught > 0, `the ${label} twin escaped every occupancy`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${[...combos()].length} occupancies`);
  });
}
