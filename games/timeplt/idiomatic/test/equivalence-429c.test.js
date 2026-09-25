// SPDX-License-Identifier: GPL-3.0-only
/**
 * setTheLaunchFacingInsideOneAimWindow — memory-equivalent to the frozen oracle at ROM 0x429C.
 *
 * DISSOLVED FORM. The tail `call 0x42B7` is gone: this routine now tails into the launcher with a
 *   DIRECT idiomatic call (commissionStagedAttackerByEra), pushing no return address (frogger's
 *   call=0 form). So the gate is on the frogger memory-eq standard, the same one equivalence-4243
 *   and equivalence-42b7 already use for this chain: the whole RAM dump is the contract, compared
 *   cell for cell OUTSIDE the frozen side's dead stack scratch, and only genuine register live-outs
 *   are pinned. The frozen oracle rets and its launcher pushes below the seat; the rewrite models no
 *   stack, so [low, seat) is masked, the floor watched off the frozen side's own pushes and proven
 *   above the game data. What used to be measured by intercepting the m.call with a recorder is now
 *   measured on the real launcher's memory writes: a wrong facing lands as a wrong byte in the new
 *   record, so the window gate and the facing split are still pinned, and harder.
 *
 * RELAXED FROM THE SEAM FORM (pc/SP only): the old gate replaced 0x42B7 with a recorder that RET'd
 *   for itself, compared the {C, IX, IY} handed over, and asserted the oracle pushed nothing up to
 *   that seam (WINDOW-STACK). The dissolved routine no longer routes through the map, so that
 *   interception cannot see it; the recorder arms are re-expressed as masked full-memory diffs with
 *   the real launcher underneath (CORPUS + the three sweeps), the push assertion becomes a MASK
 *   FLOOR arm (the launcher's stack window stays above game data), and the facing readback reads the
 *   byte the launcher actually stored (new record +0x01) instead of the byte handed to a recorder.
 *   Memory and register-out coverage is unchanged or wider; only the pc/SP contract moved.
 *
 * What it exercises, holes stated:
 *   1. REACH — dispatch counts for this address and its dispatcher, under both tapes.
 *   2. MASK FLOOR — the frozen side's stack window stays above the game data, so nothing live is masked.
 *   3. CORPUS — every captured machine replays identically, real launcher underneath, masked stack.
 *   4. ARMS — how many corpus entries take each of the three arms, all three asserted seen.
 *   5. HALF-WIDTH — all 256 half-widths against the real launcher.
 *   6. COORDINATE — all 256 values of the gating coordinate, at six half-widths.
 *   7. FACING — all 256 values of the other coordinate, window held open.
 *   8. SHAPE — which coordinates the window admits, pinned against a set built the other way round.
 *   9. FACING LINE — where the split between the two facings falls, pinned by value.
 *  10. EXCLUDED — no register outside the declared ceiling moves, with a control twin that moves IX.
 *  11. TEETH — seven twins, each caught on at least one sweep.
 *
 * HOLE: the sweeps vary those three bytes and nothing else; the rest of each machine is whatever the
 * captured entry happened to hold, and only one captured entry seeds the sweeps.
 * HOLE: what the launcher does BEYOND the facing byte is commissionStagedAttackerByEra's own gate
 * (equivalence-42b7); here it runs for real, so a divergence would show, but nothing isolates it.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-429c.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { setTheLaunchFacingInsideOneAimWindow } from "../setTheLaunchFacingInsideOneAimWindow.js";
import { loc_429c as oracle } from "../../translated/loc_429c.js";
import { loc_4243 as dispatcher } from "../../translated/loc_4243.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x429c;
const DISPATCHER = 0x4243;
const LAUNCHER = 0x42b7;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

/** The three cells, and the two fixed lines — derived here so a module edit cannot pass. */
const WINDOW_HALF_WIDTH = 0xa8e6;
const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;
const OTHER_COORD = 0x31;

/** The launcher's staged-record pointer, and the two cells it stamps: +0x01 gets the facing, +0x00
 *  (the new object's active count) is wound down. The facing byte is READ BACK from +0x01, and the
 *  decrement of +0x00 from a sentinel is how a launch is told from a no-launch. */
const SCRATCH_PTR_A = 0xa991;
const RECORD_FACING = 0x01;
const RECORD_COUNT = 0x00;
const COUNT_SENTINEL = 0x80;

const VALUES = 256;
const CORPUS_ENTRIES = 100;
const HALF_WIDTHS = [0x00, 0x01, 0x0a, 0x40, 0x80, 0xff];

/** Every game cell this chain writes sits at or below here; the stack window must stay above it. */
const DATA_TOP = 0xadff;

/**
 * The register ceiling — the same set equivalence-4243 measured for this launcher chain. The frozen
 * side rets (SP moves) and the launcher scrambles the scratch file; the two index registers are the
 * genuine live-outs, restored to the spawner by the launcher and never moved on the no-launch arm,
 * so IX/IY are PINNED (not listed) and a divergence in them is caught. A CEILING, not a demand.
 */
const MOVED = ["a", "a_", "b", "c", "d", "e", "f", "h", "l", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "registers" : hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

// ── the captured machines ───────────────────────────────────────────────────────────────

/** Dispatch counts for this address AND its dispatcher, under one tape. */
function dispatchCounts(opts) {
  const seen = { [TARGET]: 0, [DISPATCHER]: 0 };
  const overrides = new Map([
    [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
    [DISPATCHER, (mm) => { seen[DISPATCHER]++; return dispatcher(mm); }],
  ]);
  const m = makeMachine(overrides, opts);
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `run stopped early: ${m.stoppedBy}`);
  return seen;
}

let captured = null;

function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CORPUS_ENTRIES) entries.push(lean(mm.clone()));
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// ── comparison (frogger standard: masked stack, real launcher underneath) ─────────────────

/**
 * Oracle vs candidate on independent clones, launcher running for real underneath both. The frozen
 * side rets and its launcher pushes below the seat, so RAM is diffed OUTSIDE [low, seat), with low
 * watched off the frozen side's OWN pushes; the rewrite models no stack. Registers outside the
 * ceiling are pinned. `setup` places the crafted bytes on both sides before either runs.
 */
function unitDiff(candidate, machine, setup) {
  const a = machine.clone();
  const b = machine.clone();
  if (setup) {
    setup(a);
    setup(b);
  }
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 60) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

/** The frozen side's stack window over one machine, for the MASK FLOOR arm. */
function maskFloor(machine, setup) {
  const a = machine.clone();
  if (setup) setup(a);
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  return { seat, low };
}

/** Set the three bytes this routine reads on a machine. */
function place(mm, half, coord, other) {
  mm.mem8[WINDOW_HALF_WIDTH] = half;
  mm.mem8[mm.regs.iy] = coord;
  mm.mem8[(mm.regs.iy + OTHER_COORD) & 0xffff] = other;
}

/**
 * Run the real routine on one crafted placement and report the facing it handed the launcher, or
 * null when it ended without launching. Launch is told by the launcher winding the new record's
 * count (+0x00) down from a sentinel; the facing is the byte it stamped at +0x01.
 */
function stagedFacing(half, coord, other) {
  const probe = capture()[0].clone();
  place(probe, half, coord, other);
  const record = probe.mem16[SCRATCH_PTR_A];
  probe.mem8[(record + RECORD_COUNT) & 0xffff] = COUNT_SENTINEL;
  setTheLaunchFacingInsideOneAimWindow(probe);
  const launched = probe.mem8[(record + RECORD_COUNT) & 0xffff] !== COUNT_SENTINEL;
  return launched ? probe.mem8[(record + RECORD_FACING) & 0xffff] : null;
}

// ── the crafted sweeps ──────────────────────────────────────────────────────────────────

/** Every half-width, with both coordinates held at the captured entry's own values. */
function sweepHalfWidth(candidate) {
  const base = capture()[0];
  const coord = base.mem8[base.regs.iy];
  const other = base.mem8[(base.regs.iy + OTHER_COORD) & 0xffff];
  let caught = 0;
  for (let half = 0; half < VALUES; half++) {
    if (unitDiff(candidate, base, (mm) => place(mm, half, coord, other))) caught++;
  }
  return caught;
}

/** Every value of the gating coordinate, at six half-widths spanning the doubling wrap. */
function sweepCoordinate(candidate) {
  const base = capture()[0];
  let caught = 0;
  for (const half of HALF_WIDTHS) {
    for (let coord = 0; coord < VALUES; coord++) {
      if (unitDiff(candidate, base, (mm) => place(mm, half, coord, 0x40))) caught++;
    }
  }
  return caught;
}

/** Every value of the other coordinate, with the window held open. */
function sweepFacing(candidate) {
  const base = capture()[0];
  let caught = 0;
  for (let other = 0; other < VALUES; other++) {
    if (unitDiff(candidate, base, (mm) => place(mm, 0x40, WINDOW_CENTRE, other))) caught++;
  }
  return caught;
}

const SWEEP_RUNS = {
  halfWidth: VALUES,
  coordinate: HALF_WIDTHS.length * VALUES,
  facing: VALUES,
};

/** Which arm an entry takes, decided from the cells rather than from either arm's code. */
function armOf(mm) {
  const half = mm.mem8[WINDOW_HALF_WIDTH];
  const reach = (WINDOW_CENTRE - mm.mem8[mm.regs.iy] + half) & 0xff;
  if (reach >= ((half + half) & 0xff)) return "outside";
  return mm.mem8[(mm.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? "far" : "near";
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the tell that a gate is measuring an idle entry. */
function brokenNoOp() {}

/** BUG: launches whatever the coordinate is, so the window gates nothing. */
function brokenWindowAlwaysOpen(m) {
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: takes the window as the half-width rather than the doubled one, halving its reach. */
function brokenWindowNotDoubled(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= half) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: never re-centres, so the window sits at the origin instead of on the line. */
function brokenWindowNotCentred(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy]) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: hands over the facing the other way round. */
function brokenFacingInverted(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] > FACING_LINE ? 0 : 1;
  return m.call(LAUNCHER);
}

/** BUG: puts the line one place along, so the coordinate ON it flips to the wrong side. */
function brokenFacingLineOffByOne(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[(m.regs.iy + OTHER_COORD) & 0xffff] >= FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: reads the facing off the gating coordinate instead of the other one. */
function brokenFacingFromWrongAxis(m) {
  const half = m.mem8[WINDOW_HALF_WIDTH];
  if (((WINDOW_CENTRE - m.mem8[m.regs.iy] + half) & 0xff) >= ((half + half) & 0xff)) return;
  m.regs.c = m.mem8[m.regs.iy] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}

/** BUG: scribbles IX, a genuine live-out outside the ceiling — the control for the EXCLUDED arm. */
function brokenMovesIx(m) {
  setTheLaunchFacingInsideOneAimWindow(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["window-always-open", brokenWindowAlwaysOpen],
  ["window-not-doubled", brokenWindowNotDoubled],
  ["window-not-centred", brokenWindowNotCentred],
  ["facing-inverted", brokenFacingInverted],
  ["facing-line-off-by-one", brokenFacingLineOffByOne],
  ["facing-from-wrong-axis", brokenFacingFromWrongAxis],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the driven tape dispatches it, the idle one cannot", { skip }, () => {
  const driven = dispatchCounts({});
  const idle = dispatchCounts({ tape: [] });
  assert.ok(driven[TARGET] > 0, "vacuous: the tape never reached the routine");
  // The idle zero is only worth reporting alongside the reason: its dispatcher runs zero times too.
  assert.equal(idle[DISPATCHER], 0, "the idle tape DOES run the dispatcher now, so its zero for " +
    "this address needs a different explanation than the one stated here");
  console.log(`  REACH: ${hex4(TARGET)} entered ${driven[TARGET]} times driven and ` +
    `${idle[TARGET]} idle; its dispatcher ${hex4(DISPATCHER)} entered ` +
    `${driven[DISPATCHER]} and ${idle[DISPATCHER]}`);
});

test("MASK FLOOR: the frozen side's stack window stays above the game data", { skip }, () => {
  let low = 0x10000;
  let seat = 0;
  for (const e of capture()) {
    const r = maskFloor(e);
    low = Math.min(low, r.low);
    seat = r.seat;
  }
  assert.ok(low > DATA_TOP, `the stack window ${hex4(low)} reached into game data at or below ${hex4(DATA_TOP)}`);
  console.log(`  MASK FLOOR: window floor ${hex4(low)} under seat ${hex4(seat)}, clear of ${hex4(DATA_TOP)}`);
});

test("CORPUS: every captured machine replays identically", { skip }, () => {
  const entries = capture();
  assert.notEqual(entries[0] ?? null, null, "vacuous: the tape never reached the routine");
  for (const e of entries) {
    const d = unitDiff(setTheLaunchFacingInsideOneAimWindow, e);
    assert.equal(d, null, show(d));
  }
  console.log(`  CORPUS: ${entries.length} captured machines identical, with the real launcher ` +
    "running underneath and the frozen side's stack masked");
});

test("ARMS: the corpus takes all three arms", { skip }, () => {
  const tally = { outside: 0, near: 0, far: 0 };
  for (const e of capture()) tally[armOf(e)]++;
  console.log(`  ARMS: outside ${tally.outside}, near ${tally.near}, far ${tally.far}`);
  for (const arm of ["outside", "near", "far"]) {
    assert.ok(tally[arm] > 0, `the corpus never takes the ${arm} arm, so the real-launcher arm is ` +
      "not covering it and only the sweeps are");
  }
});

test("HALF-WIDTH: all 256 half-widths", { skip }, () => {
  assert.equal(sweepHalfWidth(setTheLaunchFacingInsideOneAimWindow), 0, "a half-width diverged");
  console.log(`  HALF-WIDTH: ${SWEEP_RUNS.halfWidth} values identical`);
});

test("COORDINATE: all 256 gating coordinates, at six half-widths", { skip }, () => {
  assert.equal(sweepCoordinate(setTheLaunchFacingInsideOneAimWindow), 0, "a coordinate diverged");
  console.log(`  COORDINATE: ${SWEEP_RUNS.coordinate} coordinate-and-half-width pairs identical`);
});

test("FACING: all 256 values of the other coordinate", { skip }, () => {
  assert.equal(sweepFacing(setTheLaunchFacingInsideOneAimWindow), 0, "a facing coordinate diverged");
  console.log(`  FACING: ${SWEEP_RUNS.facing} values identical`);
});

/**
 * Which coordinates the window admits, built as a SET by walking back from its top edge — the
 * other way round from the subtract-and-compare the routine performs, so the two can disagree.
 */
function windowMembers(half) {
  const width = (half + half) & 0xff;
  const top = (WINDOW_CENTRE + half) & 0xff;
  const members = new Set();
  for (let k = 0; k < width; k++) members.add((top - k) & 0xff);
  return members;
}

test("SHAPE: which coordinates the window admits, pinned as a set", { skip }, () => {
  const shut = [];
  for (const half of [...HALF_WIDTHS, 0xc0, 0x7f, 0x81]) {
    const members = windowMembers(half);
    if (members.size === 0) shut.push(half);
    for (let coord = 0; coord < VALUES; coord++) {
      const open = stagedFacing(half, coord, 0x00) !== null;
      assert.equal(open, members.has(coord),
        `half-width ${hex4(half)} at coordinate ${hex4(coord)}: the routine says ` +
          `${open ? "inside" : "outside"} and the set says the opposite`);
    }
  }
  assert.deepEqual(shut, [0x00, 0x80], "the half-widths that shut the window have changed, so the " +
    "doubling no longer wraps the way this arm and the header both say it does");
  console.log(`  SHAPE: nine half-widths agree with the set over all ${VALUES} coordinates; ` +
    `${shut.map(hex4).join(" and ")} shut it entirely`);
});

test("FACING LINE: the line itself is one side, one place past it the other", { skip }, () => {
  const half = 0x0a;
  assert.equal(stagedFacing(half, WINDOW_CENTRE, FACING_LINE), 0, "the line itself is the near side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, FACING_LINE + 1), 1,
    "one place past the line is the far side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, 0x00), 0, "the bottom of the range is the near side");
  assert.equal(stagedFacing(half, WINDOW_CENTRE, 0xff), 1, "the top of the range is the far side");
  console.log(`  FACING LINE: the split falls between ${hex4(FACING_LINE)} and ` +
    `${hex4(FACING_LINE + 1)}, with the line itself on the near side`);
});

function movedOver(candidate) {
  const moved = new Set();
  for (const e of capture()) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    try {
      candidate(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const moved = movedOver(setTheLaunchFacingInsideOneAimWindow);
  const control = movedOver(brokenMovesIx);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles on IX, " +
      "so a clean reading below proves nothing");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}; the control twin also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !MOVED.includes(k)).join(", ")}`);
  // MOVED is a CEILING. deepEqual against it would DEMAND the divergence and go RED on a rewrite
  // that became register-exact — a gate that requires a wart refuses the fix.
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const halfWidth = sweepHalfWidth(twin);
    const coordinate = sweepCoordinate(twin);
    const facing = sweepFacing(twin);
    console.log(`  TEETH/${label}: caught on ${halfWidth}/${SWEEP_RUNS.halfWidth} half-widths, ` +
      `${coordinate}/${SWEEP_RUNS.coordinate} coordinates, ${facing}/${SWEEP_RUNS.facing} facings`);
    assert.ok(halfWidth + coordinate + facing > 0, `every sweep PASSED the ${label} twin`);
  });
}
