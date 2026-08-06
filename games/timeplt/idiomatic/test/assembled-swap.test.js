// SPDX-License-Identifier: GPL-3.0-only
/**
 * assembled-swap — the WHOLE-GAME gate for the REGISTERED Time Pilot rewrites.
 *
 * WHAT IT COVERS, exactly. It wires the entries of idiomatic/names.js ROUTINES and only those.
 * The idiomatic directory holds many more files than the registry names, and every one of them is
 * outside this gate — the registry is what the machine dispatches and what ships, so that is what
 * is under test here. The run prints how many entries were wired, how many were dispatched, and
 * which registered ones neither scenario reaches, so "transparent" cannot be read as covering
 * routines this file never ran.
 *
 * WHAT IT ADDS THAT THE PER-ROUTINE GATES CANNOT. Every equivalence-*.test.js runs ONE rewrite
 * against the oracle on a captured entry state, in isolation. A routine can be right there and
 * still break the assembled machine, because isolation never exercises the thing that joins
 * routines together: the calling convention. This file assembles the game instead. It runs the
 * whole thing TWICE from reset -- pure translated as the baseline, and with the registered
 * rewrites wired live over the oracle registry -- and asserts the two runs are byte-identical in
 * memory, frame by frame, for the whole run. A memory-equivalent rewrite is a TRANSPARENT swap:
 * wiring it live must change nothing at all.
 *
 * IT ALSO WATCHES THE SEAM ITSELF. machine.js's withOmittedRet supplies the `ret` a rewrite omits,
 * which is right only for a routine whose ROM form is exactly one `ret`. Every dispatch is
 * measured for its net effect on SP, and anything but the caller's two bytes fails with the
 * routine named — because the byte diff alone reports a corrupted cell and names nothing.
 *
 * ★ WHAT IT DOES NOT COVER, and both holes matter.
 *   1. Registered rewrites that NEITHER scenario dispatches. The run names them, computed as the
 *      intersection of the two scenarios and not off one of them. For those addresses this file
 *      establishes nothing at all: not transparency, and not the seam precondition above.
 *   2. Every rewrite outside ROUTINES. Only the registry is wired here, so a file that exists on
 *      disk and is not registered is ungated by this gate however green it runs.
 *
 * ★ IT REPLAYS AN INPUT TAPE, not just the attract loop. Undriven attract never banks a credit,
 * never enters the credit / push-start phase, and never sets the play flag, so an attract-only
 * gate is blind to the whole of the machine that a coin turns on. The tape here MIRRORS
 * games/timeplt/tools/tapes/coin_play.lua bit for bit and period for period -- coin, start, then
 * a stick that rotates through the four directions on a period coprime with the fire period --
 * and the gate asserts the game RESPONDS to it before it asserts the two runs agree.
 *
 * THE ENGINE, and why not the cycle-driven one. The rewrites are cycle-free: they never call
 * m.step, so they charge no T-states, and under the cycle-driven engine the vblank NMI would
 * land at a different point in the instruction stream in the swapped run than in the baseline.
 * That is a difference in the harness, not in the rewrite, and it would be read as a failure.
 * core/frame-stepped.js runCycleFree removes the clock: the NMI fires when control reaches a poll
 * PC. Time Pilot's poll PC, and the price it charges, are documented in manifest.convergence --
 * read that before trusting a number out of this file.
 *
 * TEETH ARE PART OF THE GATE, not a one-off check someone did once. The tests at the bottom each
 * wire a deliberately broken layer and assert this comparison CATCHES it: a plausible wrong twin
 * of a rewrite that runs in the scenario, a single wrong byte on a single dispatch, a stack leak
 * small enough to hide under a loose exclusion window, and the seam
 * adapter removed. A gate never observed failing is not known to work, so it observes itself
 * failing on every run.
 *
 * ROM-guarded: skips, loudly, when the BYO ROM images are absent.
 *
 * Run: node --test games/timeplt/idiomatic/test/assembled-swap.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveOverrides, withOmittedRet } from "../../machine.js";
import { ROUTINES as TRANSLATED_ROUTINES } from "../../routines.js";
import manifest from "../../manifest.js";
import {
  ROUTINES,
  SEQUENCE_PHASE,
  PLAY_ACTIVE,
  COIN_ACCEPTED,
  KILLS_REMAINING,
} from "../names.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import { u8 } from "../../../../core/int.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "ROM absent at games/timeplt/rom/maincpu.bin (BYO)" }, fn);

const { pollPCs, stateExclude } = manifest.convergence;
const [STACK_LO, STACK_HI] = stateExclude.stack;

/**
 * The highest DIRECT store into work RAM -- a write whose address is neither SP nor SP+1, boot's
 * one-time wipe of the whole region excluded. Measured on a tape-driven translated run, where one
 * site accounts for it. It is NOT the exclusion floor and must not become one: everything between
 * here and STACK_LO is written by nothing, which is exactly where a leaking SP lands first. The
 * last tooth in this file exists to keep that true.
 */
const GAME_STATE_CEILING = 0xaebc;

/** Long enough to boot, attract, take the coin, start, and play out several hundred frames. */
const FRAMES = 1400;

// ── the tape ────────────────────────────────────────────────────────────────────────────────
//
// games/timeplt/tools/tapes/coin_play.lua is the pinned contract: coin at hardware frame 300 and
// start at 360, both held 8; from 420 the stick holds one of the four directions for 97 frames at
// a time and the button fires 7 frames in every 23, the two periods coprime so they cannot
// phase-lock into one repeated situation.
//
// THE FRAME ORIGIN IS DIFFERENT HERE AND THE OFFSET IS MEASURED, not guessed. Under runCycleFree
// a "frame" is one vblank NMI, and Time Pilot spends its first couple of hundred hardware frames
// in boot with the interrupt masked, so the two timelines are offset by however long that takes.
// Instrumenting a cycle-driven run for the NMI count at each of the tape's three contract frames
// gives 300 -> 65, 360 -> 125, 420 -> 185: one constant offset of 235, consistent at all three.
// That is where these numbers come from; the periods and hold lengths are the lua file's own.
const COIN_FRAME = 65;
const START_FRAME = 125;
const PLAY_FROM = 185;
const HOLD = 8;
const TURN_PERIOD = 97;
const FIRE_PERIOD = 23;
const FIRE_HOLD = 7;

const IN0 = 0xc300; // coin 1 is bit 0, 1-player start is bit 3
const IN1 = 0xc320; // left 0x01, right 0x02, up 0x04, down 0x08, button 0x10
const TURN_CYCLE = [0x04, 0x02, 0x08, 0x01]; // up, right, down, left -- the lua file's order

/** Pressed bits for frame `fi`. The io layer folds in the active-low polarity. */
function coinPlayTape(fi) {
  let in0 = 0;
  if (fi >= COIN_FRAME && fi < COIN_FRAME + HOLD) in0 |= 0x01;
  if (fi >= START_FRAME && fi < START_FRAME + HOLD) in0 |= 0x08;
  let in1 = 0;
  if (fi >= PLAY_FROM) {
    in1 |= TURN_CYCLE[Math.floor((fi - PLAY_FROM) / TURN_PERIOD) % 4];
    if ((fi - PLAY_FROM) % FIRE_PERIOD < FIRE_HOLD) in1 |= 0x10;
  }
  return { [IN0]: in0, [IN1]: in1 };
}

/** The undriven control: nothing is ever pressed. */
function silentTape() {
  return { [IN0]: 0, [IN1]: 0 };
}

// ── wiring ──────────────────────────────────────────────────────────────────────────────────

/**
 * The ROM address of the routine a PC falls inside, resolved against the TRANSLATED registry.
 *
 * It has to be the translated one. That registry holds every routine in the game, so the
 * largest start at or below a PC really is the routine containing it; the idiomatic registry is
 * sparse, so the same arithmetic over it returns whichever rewritten routine happens to sit
 * nearest below and names the wrong routine (for this game it answers 0x0b46, a six-byte routine
 * ending at 0x0b4b, for a poll PC at 0x0b93).
 */
const TRANSLATED_STARTS = [...TRANSLATED_ROUTINES.keys()].sort((a, b) => a - b);
function routineContaining(pc) {
  let found = -1;
  for (const s of TRANSLATED_STARTS) {
    if (s <= pc) found = s;
    else break;
  }
  return found;
}

/**
 * The routines that must stay TRANSLATED: whichever ones contain a poll PC. runCycleFree finds
 * the frame boundary by watching m.step reach a poll PC, and a rewrite never calls m.step -- wire
 * the poll routine and frame detection dies silently, with the run reporting zero frames and no
 * error. (For Time Pilot the poll sits in the foreground ring drain, which has no rewrite, so
 * this set is expected to be empty; it is computed rather than assumed so that it stops being
 * empty by itself on the day one is written.)
 */
const POLL_ROUTINES = new Set(pollPCs.map(routineContaining).filter((a) => a >= 0));

/** The whole idiomatic layer as a resolvable spec, minus anything holding a poll PC. */
function idiomaticSpec() {
  const spec = {};
  const excluded = [];
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    const a = Number(addr);
    if (POLL_ROUTINES.has(a)) {
      excluded.push(a);
      continue;
    }
    spec[a.toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.entry ?? meta.name };
  }
  return { spec, excluded };
}

/**
 * Count dispatches per wired address, so a "match" from a routine that never ran is visible, and
 * record every dispatch whose net effect on SP was not the caller's two bytes.
 *
 * A translated call site pushes the return address and the seam's `ret` pops it, so a balanced
 * dispatch is exactly +2. Any other figure means the rewrite's ROM form is not one net `ret` and
 * the unconditional seam is over- or under-popping it. Watching SP here names the routine; the
 * memory diff downstream sees only whichever cell the misplaced push landed in.
 */
function counted(overrides) {
  const counts = new Map();
  const wrapped = new Map();
  const seam = [];
  for (const [addr, fn] of overrides) {
    counts.set(addr, 0);
    wrapped.set(addr, (m, ...rest) => {
      const before = m.regs.sp;
      const n = counts.get(addr) + 1;
      counts.set(addr, n);
      const r = fn(m, ...rest);
      const delta = (((m.regs.sp - before) & 0xffff) << 16) >> 16;
      if (delta !== 2 && seam.length < 8) seam.push({ addr, n, before, after: m.regs.sp, delta });
      return r;
    });
  }
  return { overrides: wrapped, counts, seam };
}

// ── running and comparing ───────────────────────────────────────────────────────────────────

/**
 * One assembled run from reset. `tape(frameIndex)` is asserted onto the input ports at each
 * frame, before that frame's state is sampled -- the same order the cycle-driven engine uses, so
 * a press is in effect DURING the frame it is dated to.
 */
async function run(overrides, tape) {
  const m = await Machine.create(ROM, overrides ? { overrides } : {});
  const frames = [];
  const observed = {
    coinAcceptedFrames: 0,
    playActiveAt: -1,
    phases: new Set(),
    killsValues: new Set(),
  };
  const r = runCycleFree(m, {
    pollPCs,
    maxFrames: FRAMES,
    stepBudget: FRAMES * 20000,
    onFrame: (mm, fi) => {
      mm.io.inputAssert = tape(fi);
      frames.push(Buffer.from(mm.dumpState()));
      if (mm.mem.read8(COIN_ACCEPTED) !== 0) observed.coinAcceptedFrames++;
      if (mm.mem.read8(PLAY_ACTIVE) !== 0 && observed.playActiveAt < 0) observed.playActiveAt = fi;
      observed.phases.add(mm.mem.read8(SEQUENCE_PHASE));
      observed.killsValues.add(mm.mem.read8(KILLS_REMAINING));
    },
  });
  return { m, frames, r, observed };
}

/** The compared offsets for one exclusion window: the whole state dump minus [lo, hi). Cached. */
const COMPARED = new Map();
function comparedOffsets(probe, bytesPerFrame, lo, hi) {
  const key = `${lo},${hi}`;
  if (!COMPARED.has(key)) {
    const keep = [];
    for (let o = 0; o < bytesPerFrame; o++) {
      const a = probe.stateOffsetToAddr(o);
      if (a < lo || a >= hi) keep.push(o);
    }
    COMPARED.set(key, keep);
  }
  return COMPARED.get(key);
}

/**
 * The first frame and address at which two runs differ over compared memory, or null. Returned
 * rather than asserted, so the teeth can require a difference with the SAME comparison the real
 * arms are required to pass. `lo` is a parameter only so the last tooth can ask what a WIDER
 * window would have seen; every real arm uses the shipped one.
 */
function firstDivergence(base, other, lo = STACK_LO, hi = STACK_HI) {
  const probe = new Machine(ROM);
  const keep = comparedOffsets(probe, base.frames[0].length, lo, hi);
  // The shared prefix first: a run that also died early has a byte difference worth naming, and
  // reporting only "the lengths differ" would throw away the address that says WHERE it went
  // wrong.
  const shared = Math.min(base.frames.length, other.frames.length);
  for (let i = 0; i < shared; i++) {
    const a = base.frames[i];
    const b = other.frames[i];
    for (const o of keep) {
      if (a[o] !== b[o]) {
        return { frame: i, addr: probe.stateOffsetToAddr(o), base: a[o], other: b[o], kind: "byte" };
      }
    }
  }
  if (base.frames.length !== other.frames.length) {
    return { frame: shared, addr: null, kind: "length", base: base.frames.length, other: other.frames.length };
  }
  return null;
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const showDiff = (d) =>
  d === null
    ? "identical"
    : d.kind === "length"
      ? `identical for ${d.frame} frames, then the runs stopped at different lengths (${d.base} vs ${d.other})`
      : `frame ${d.frame} ${hex4(d.addr)}: baseline ${d.base} vs swapped ${d.other}`;

/** Assert a run completed the whole scenario. A short run's byte diff means nothing. */
function assertRanClean(r, label) {
  assert.equal(r.r.stopError, null, `${label} errored: ${r.r.stop}`);
  assert.equal(r.r.frames, FRAMES, `${label} covered only ${r.r.frames}/${FRAMES} frames (${r.r.stop})`);
}

const nameOf = (a) => ROUTINES[a]?.name ?? `loc_${(a & 0xffff).toString(16).padStart(4, "0")}`;

/** Assert every wired dispatch handed the caller's two pushed bytes back, and name the first
 *  routine that did not. Checked before the memory diff, because it EXPLAINS the memory diff. */
function assertSeamBalanced(seam, label) {
  if (seam.length === 0) return;
  const s = seam[0];
  assert.fail(
    `${label}: the seam did not balance — ${nameOf(s.addr)} (${hex4(s.addr)}) dispatch #${s.n} ` +
      `moved SP by ${s.delta}, not 2 (${hex4(s.before)} -> ${hex4(s.after)}). A translated caller ` +
      "pushes two bytes and the seam's ret pops them, so a balanced dispatch is exactly +2. " +
      "Another figure means this rewrite's ROM form is not exactly one ret, and the unconditional " +
      "seam is over- or under-popping it; a positive drift walks SP above its power-on seat.",
  );
}

/**
 * WHO PUT THAT BYTE THERE. A divergence names a frame and a cell, and the reader's next question
 * is which registered routine is responsible — which the diff cannot say, because the wrong byte
 * is usually written by translated code holding a value a rewrite left wrong. So on the failure
 * path only, re-run each arm as far as the divergent frame with a write tap on that one address
 * and report its last writer, attributed to the wired routine that was executing at the time.
 */
async function lastWriterOf(spec, tape, stopFrame, addr) {
  const m = await Machine.create(ROM, {});
  let inside = null;
  let frame = 0;
  let last = null;
  if (spec) {
    for (const [a, fn] of await resolveOverrides(spec)) {
      m.routines.set(a, (mm, ...rest) => {
        const prev = inside;
        inside = a;
        try {
          return fn(mm, ...rest);
        } finally {
          inside = prev;
        }
      });
    }
  }
  const write8 = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, cy) => {
    if (a === addr) last = { frame, by: inside, pc: m.pc, value: v };
    return write8(a, v, cy);
  };
  try {
    runCycleFree(m, {
      pollPCs,
      maxFrames: stopFrame + 1,
      stepBudget: FRAMES * 20000,
      onFrame: (mm, fi) => {
        frame = fi;
        mm.io.inputAssert = tape(fi);
      },
    });
  } catch {
    // An arm that derails on the way has still recorded everything up to the point it died,
    // which is the part being asked about.
  }
  return last;
}

/** The two attributions, as lines to hang under a divergence message. */
async function explain(spec, tape, d) {
  if (d === null || d.addr === null || d.addr === undefined) return "";
  const show = (w) =>
    w === null
      ? "never written"
      : w.by !== null
        ? `${nameOf(w.by)} (${hex4(w.by)}) at frame ${w.frame}, wrote ${w.value}`
        : `translated pc ${hex4(w.pc)} at frame ${w.frame}, wrote ${w.value}`;
  const swapped = await lastWriterOf(spec, tape, d.frame, d.addr);
  const base = await lastWriterOf(null, tape, d.frame, d.addr);
  return (
    `\n      last write, swapped run:  ${show(swapped)}` +
    `\n      last write, baseline run: ${show(base)}`
  );
}

// Baselines and the wired layer, built once and shared: they are pure functions of the ROM.
let attractBase = null;
let tapeBase = null;
let liveSpec = null;

async function baselines() {
  if (attractBase === null) {
    liveSpec = idiomaticSpec();
    attractBase = await run(null, silentTape);
    tapeBase = await run(null, coinPlayTape);
    assertRanClean(attractBase, "attract baseline");
    assertRanClean(tapeBase, "tape baseline");
  }
  return { attractBase, tapeBase, liveSpec };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("attract: the wired idiomatic layer is a transparent swap in the assembled game", async () => {
  const { attractBase: base, liveSpec: live } = await baselines();
  const { overrides, counts, seam } = counted(await resolveOverrides(live.spec));
  assert.ok(overrides.size > 0, "vacuous: no idiomatic routine was wired");

  const swapped = await run(overrides, silentTape);
  assertSeamBalanced(seam, "attract swapped run");
  assertRanClean(swapped, "attract swapped run");
  const d = firstDivergence(base, swapped);
  if (d !== null) {
    assert.fail(
      `the wired swap changed the assembled game — ${showDiff(d)}` +
        (await explain(live.spec, silentTape, d)),
    );
  }

  const ran = [...counts.values()].filter((c) => c > 0).length;
  assert.ok(ran > 0, "vacuous: the attract run dispatched none of the wired routines");
  const dispatches = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(
    `  ATTRACT: ${overrides.size} routines wired, ${ran} dispatched, identical over ` +
      `${base.frames.length} frames outside [${hex4(STACK_LO)},${hex4(STACK_HI)}); ` +
      `${dispatches} dispatches all balanced the seam at +2`,
  );
  if (live.excluded.length) {
    console.log(`  kept translated (holds a poll PC): ${live.excluded.map(hex4).join(" ")}`);
  }
});

test("tape: the game RESPONDS to coin, start and play — which attract never does", async () => {
  const { attractBase: attract, tapeBase: driven } = await baselines();

  assert.ok(
    driven.observed.coinAcceptedFrames > 0,
    "the coin was never accepted: the tape is not reaching the machine, so everything this " +
      "file says about a played game would be a statement about attract mode",
  );
  assert.ok(
    driven.observed.phases.has(2),
    `the credit / push-start phase was never entered (phases seen: ${[...driven.observed.phases].join(",")})`,
  );
  assert.ok(
    driven.observed.playActiveAt >= START_FRAME &&
      driven.observed.playActiveAt <= START_FRAME + 16,
    `the play flag came up at frame ${driven.observed.playActiveAt}, not within 16 frames of ` +
      `the tape's start press at ${START_FRAME}`,
  );
  assert.ok(
    driven.observed.killsValues.size > 1,
    "the kill quota never moved, so the plane never shot anything and the tape drives no play",
  );

  // The control that makes the point: none of the above happens without the tape.
  assert.equal(attract.observed.playActiveAt, -1, "undriven attract set the play flag");
  assert.equal(attract.observed.coinAcceptedFrames, 0, "undriven attract accepted a coin");
  assert.ok(!attract.observed.phases.has(2), "undriven attract entered the credit phase");

  console.log(
    `  TAPE RESPONDS: coin accepted over ${driven.observed.coinAcceptedFrames} frames, phases ` +
      `{${[...driven.observed.phases].sort().join(",")}}, play flag up at frame ` +
      `${driven.observed.playActiveAt}, kill quota took ${driven.observed.killsValues.size} values ` +
      `— attract reaches phases {${[...attract.observed.phases].sort().join(",")}} and none of it`,
  );
});

test("tape: the wired idiomatic layer is a transparent swap through coin, start and play", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();
  const { overrides, counts, seam } = counted(await resolveOverrides(live.spec));

  const swapped = await run(overrides, coinPlayTape);
  assertSeamBalanced(seam, "tape swapped run");
  assertRanClean(swapped, "tape swapped run");
  const d = firstDivergence(base, swapped);
  if (d !== null) {
    assert.fail(
      `the wired swap changed the played game — ${showDiff(d)}` +
        (await explain(live.spec, coinPlayTape, d)),
    );
  }

  const ran = [...counts.entries()].filter(([, c]) => c > 0);
  assert.ok(ran.length > 0, "vacuous: the tape dispatched none of the wired routines");

  // What the tape bought, in routines rather than in adjectives.
  const attractRan = new Set(
    (await (async () => {
      const c = counted(await resolveOverrides(live.spec));
      await run(c.overrides, silentTape);
      return [...c.counts.entries()].filter(([, n]) => n > 0).map(([a]) => a);
    })()),
  );
  const tapeOnly = ran.map(([a]) => a).filter((a) => !attractRan.has(a));
  // "Neither scenario" is an INTERSECTION and has to be computed as one. Reading it off the tape
  // run alone reports every attract-only routine as unexercised -- a gate overstating its own
  // hole, in a line that gets quoted forward.
  const never = [...counts.entries()]
    .filter(([a, c]) => c === 0 && !attractRan.has(a))
    .map(([a]) => a);
  console.log(
    `  TAPE: ${ran.length}/${counts.size} routines dispatched, identical over ` +
      `${base.frames.length} frames; ${tapeOnly.length} reached only with the tape` +
      (tapeOnly.length ? ` (${tapeOnly.map(hex4).join(" ")})` : ""),
  );
  if (never.length) {
    console.log(
      `  NOT EXERCISED by EITHER scenario, so "transparent" says nothing about these, and neither ` +
        `does the seam check: ${never.map(hex4).join(" ")}`,
    );
  }
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────────
//
// Each tooth wires the real layer with ONE thing wrong and requires the comparison above to
// catch it. A tooth that passes is a gate that has stopped working, so these fail loudly rather
// than warn.

/** The rewrite the twins are built from: it steps the character cursor back one cell. */
const CURSOR_STEP = 0x0020;

/**
 * BUG: subtracts the cell stride from the low half only, dropping the borrow into the high half.
 * The classic form of getting this routine wrong, and invisible until a line crosses a boundary.
 */
function cursorDropsBorrow(m) {
  m.regs.e = u8(m.regs.e - 32);
}

test("TEETH: a plausible wrong twin of a dispatched rewrite is CAUGHT", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();
  const overrides = await resolveOverrides(live.spec);
  assert.ok(overrides.has(CURSOR_STEP), `${hex4(CURSOR_STEP)} is not wired, so this tooth is blunt`);

  // Confirm the twin's host actually runs here — a tooth on an unreached routine proves nothing.
  const probe = counted(overrides);
  await run(probe.overrides, coinPlayTape);
  assert.ok(probe.counts.get(CURSOR_STEP) > 0, `${hex4(CURSOR_STEP)} never dispatched in the tape run`);

  overrides.set(CURSOR_STEP, withOmittedRet(cursorDropsBorrow));
  const broken = await run(overrides, coinPlayTape);
  const d = firstDivergence(base, broken);
  assert.notEqual(d, null, "the drops-borrow twin ran the whole game unnoticed — this gate is blind");
  console.log(`  TEETH/drops-borrow: caught — ${showDiff(d)}`);
});

/**
 * How many of the FIRST `n` dispatches of the cursor step can be spoiled by one byte and still be
 * caught. Not all of them, and that is the honest shape of this gate rather than a defect in it:
 * the last cursor step of a text run is discarded by its caller, so spoiling THAT one changes no
 * memory anywhere and nothing downstream can see it. What the sweep establishes is resolution —
 * that a fault does not have to be gross to be caught.
 */
const ONE_BYTE_SWEEP = 16;

test("TEETH: ONE wrong byte on ONE dispatch is CAUGHT", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();

  const results = [];
  for (let target = 1; target <= ONE_BYTE_SWEEP; target++) {
    const overrides = await resolveOverrides(live.spec);
    const real = overrides.get(CURSOR_STEP);
    let n = 0;
    // The real rewrite, unaltered, except that ONE of its dispatches leaves the cursor one short.
    overrides.set(CURSOR_STEP, (m, ...rest) => {
      const r = real(m, ...rest);
      if (++n === target) m.regs.e = u8(m.regs.e - 1);
      return r;
    });
    results.push([target, firstDivergence(base, await run(overrides, coinPlayTape))]);
  }

  const caught = results.filter(([, d]) => d !== null);
  assert.ok(
    caught.length > 0,
    `not one of ${ONE_BYTE_SWEEP} single-byte, single-dispatch faults survived to be seen — this ` +
      "gate cannot resolve the faults it exists to find",
  );
  const missed = results.filter(([, d]) => d === null).map(([i]) => `#${i}`);
  console.log(
    `  TEETH/one-byte: caught ${caught.length}/${ONE_BYTE_SWEEP} — first at dispatch ` +
      `#${caught[0][0]}, ${showDiff(caught[0][1])}` +
      (missed.length ? `; invisible on ${missed.join(" ")} (cursor discarded by the caller)` : ""),
  );
});

/**
 * Dispatches that leak two bytes of stack each. SMALL ON PURPOSE: the leak has to stop while it is
 * still inside the dead space between the game-state ceiling and the stack, because that is the
 * range this tooth is about. A bigger leak eventually derails the machine and any window catches
 * it, which would prove nothing about where the exclusion floor belongs.
 */
const LEAK_DISPATCHES = 8;

test("TEETH: a stack leak short of the game-state ceiling is CAUGHT, and would not be by a wider window", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();
  const overrides = await resolveOverrides(live.spec);
  const real = overrides.get(CURSOR_STEP);
  let n = 0;
  // The rewrite is left correct and the seam is left in place; SP is simply walked down two bytes
  // on each of the first few dispatches, which is what an unhealed omitted `ret` does. Pushes and
  // pops still pair, so control flow stays valid and nothing but compared memory can report it.
  overrides.set(CURSOR_STEP, (m, ...rest) => {
    const r = real(m, ...rest);
    if (++n <= LEAK_DISPATCHES) m.regs.sp = (m.regs.sp - 2) & 0xffff;
    return r;
  });

  const leaked = await run(overrides, coinPlayTape);
  // It must NOT derail: a run that crashes would be caught by any window at all, and then this
  // tooth would be testing the crash rather than the width of the exclusion.
  assertRanClean(leaked, "leaked run");
  const d = firstDivergence(base, leaked);
  assert.notEqual(d, null, "a walking stack pointer ran the whole game unnoticed — this gate is blind");

  // The discriminating half. Floored at the game-state ceiling instead of at the measured stack,
  // the SAME comparison sees nothing for the whole run. That is the width this window must never
  // have, and this assertion is what keeps it from drifting back.
  const wider = firstDivergence(base, leaked, GAME_STATE_CEILING, STACK_HI);
  assert.equal(
    wider,
    null,
    `a window floored at ${hex4(GAME_STATE_CEILING)} caught this too (${showDiff(wider)}), so this ` +
      "tooth no longer discriminates between the two floors — re-derive both before trusting it",
  );
  console.log(
    `  TEETH/stack-leak: caught — ${showDiff(d)}; the same run is IDENTICAL over ` +
      `${leaked.frames.length} frames to a window floored at ${hex4(GAME_STATE_CEILING)}`,
  );
});

test("TEETH: the seam adapter removed is CAUGHT", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();

  // The same layer, resolved WITHOUT machine.js's withOmittedRet — so every translated caller
  // pushes a return address that its idiomatic callee never pops. Time Pilot re-seats SP only at
  // boot, so this is unbounded; the gate must not let it through as a rounding error.
  const raw = new Map();
  for (const [key, ent] of Object.entries(live.spec)) {
    const mod = await import(new URL(ent.module, new URL("../../machine.js", import.meta.url)).href);
    raw.set(parseInt(key, 16), mod[ent.export]);
  }
  const leaked = await run(raw, coinPlayTape);
  const d = firstDivergence(base, leaked);
  const errored = leaked.r.stopError !== null || leaked.r.frames !== FRAMES;
  assert.ok(
    errored || d !== null,
    "the layer wired with no seam ret ran the whole game identically, which cannot be true: " +
      "either the seam is not doing what its docstring claims, or this comparison is not looking",
  );
  console.log(
    `  TEETH/no-seam-ret: caught — ` +
      (errored ? `run stopped at ${leaked.r.frames}/${FRAMES} frames (${leaked.r.stop})` : showDiff(d)),
  );
});
