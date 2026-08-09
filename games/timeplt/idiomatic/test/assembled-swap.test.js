// SPDX-License-Identifier: GPL-3.0-only
/**
 * assembled-swap — RETIRED AT THE COROUTINE GO-LIVE. NOTHING BELOW RUNS: 9 tests, 9 skipped.
 *
 * ⛔ READ THIS BEFORE THE REST OF THE HEADER, WHICH DESCRIBES THE GATE AS IT WAS. Every sentence
 * after this block is written in the present tense about a gate that no longer executes — it
 * "runs the whole thing twice", "observes itself failing", "skips loudly without ROMs". None of
 * that happens now; the file skips unconditionally. The reason and the measurement are at the
 * `const test =` binding below, and golive.test.js is what replaced it. The description is kept
 * because the harness is kept, not because it is still true.
 *
 * WHAT IT COVERED, while it ran:
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
 * IT ALSO WATCHES THE SEAM ITSELF. machine.js's withOmittedRet supplies the `ret` a rewrite omits
 * — and stands aside for one that reached its ROM `ret` through a transfer into still-translated
 * code, which returns having already popped. Either way the DISPATCH owes the caller its two
 * bytes back and nothing else, so every dispatch is measured for its net effect on SP and
 * anything but +2 fails with the routine named — the byte diff alone reports a corrupted cell and
 * names nothing. The two shapes are bracketed by their own tests near the bottom of this file.
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
 * small enough to hide under a loose exclusion window, the seam adapter removed, and a rewrite
 * that returns one time too many. A gate never observed failing is not known to work, so it
 * observes itself failing on every run.
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
const test = (name, fn) =>
  nodeTest(name, { skip: "retired: swap-era gate on runCycleFree, which cannot drive the coroutine spine; superseded by golive.test.js" }, fn);

const { pollPCs, stateExclude } = manifest.convergence;
const [STACK_LO, STACK_HI] = stateExclude.stack;

const GAME_STATE_CEILING = 0xaebc;

const FRAMES = 1400;

// ── the tape ────────────────────────────────────────────────────────────────────────────────
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

function silentTape() {
  return { [IN0]: 0, [IN1]: 0 };
}

// ── wiring ──────────────────────────────────────────────────────────────────────────────────

const TRANSLATED_STARTS = [...TRANSLATED_ROUTINES.keys()].sort((a, b) => a - b);
function routineContaining(pc) {
  let found = -1;
  for (const s of TRANSLATED_STARTS) {
    if (s <= pc) found = s;
    else break;
  }
  return found;
}

const POLL_ROUTINES = new Set(pollPCs.map(routineContaining).filter((a) => a >= 0));

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

async function run(overrides, tape, spoil = null) {
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
      if (spoil !== null) spoil(mm, fi);
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

function firstDivergence(base, other, lo = STACK_LO, hi = STACK_HI) {
  const probe = new Machine(ROM);
  const keep = comparedOffsets(probe, base.frames[0].length, lo, hi);
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

/** The rewrite the twins are built from: it steps the character cursor back one cell. */
const CURSOR_STEP = 0x0020;

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
 * Frames that leak two bytes of stack each. SMALL ON PURPOSE: the leak has to stop while it is
 * still inside the dead space between the game-state ceiling and the stack, because that is the
 * range this tooth is about. A bigger leak eventually derails the machine and any window catches
 * it, which would prove nothing about where the exclusion floor belongs.
 *
 * ★ AND IT BELONGS TO NO DISPATCH, which is a requirement and not a convenience. The seam measures
 * every dispatch, so a leak injected INSIDE one is attributed to whichever wired routine encloses
 * it and stopped there -- by the seam, loudly, which is a different tooth's job (the two below).
 * This tooth is about the WIDTH OF THE WINDOW: it needs the one leak nothing can attribute, so it
 * walks SP at the frame boundary, where no rewrite is running and only compared memory can report
 * it. Moving it back inside a rewrite makes it test the seam instead, and silently.
 */
const LEAK_FRAMES = 8;

test("TEETH: a stack leak short of the game-state ceiling is CAUGHT, and would not be by a wider window", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();
  const overrides = await resolveOverrides(live.spec);

  const leaked = await run(overrides, coinPlayTape, (m, fi) => {
    if (fi > 0 && fi <= LEAK_FRAMES) m.regs.sp = (m.regs.sp - 2) & 0xffff;
  });
  assertRanClean(leaked, "leaked run");
  const d = firstDivergence(base, leaked);
  assert.notEqual(d, null, "a walking stack pointer ran the whole game unnoticed — this gate is blind");

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

// ── the seam's OTHER shape, bracketed ────────────────────────────────────────────────────────

/** The raw, unwrapped export a spec entry names: the rewrite exactly as its module defines it. */
async function rawExport(spec, addr) {
  const ent = spec[addr.toString(16)];
  assert.ok(ent, `${hex4(addr)} is not in the wired spec, so this test is blunt`);
  const mod = await import(new URL(ent.module, new URL("../../machine.js", import.meta.url)).href);
  return mod[ent.export];
}

test("SEAM: a rewrite that performs its OWN ROM ret is passed through, and stays transparent", async () => {
  const { tapeBase: base, liveSpec: live } = await baselines();
  const overrides = await resolveOverrides(live.spec);
  const raw = await rawExport(live.spec, CURSOR_STEP);

  const selfCompleting = withOmittedRet((m, ...rest) => {
    const r = raw(m, ...rest);
    m.ret();
    return r;
  }, CURSOR_STEP);
  const { overrides: wired, counts, seam } = counted(
    new Map(overrides).set(CURSOR_STEP, selfCompleting),
  );

  const swapped = await run(wired, coinPlayTape);
  assertSeamBalanced(seam, "self-completing rewrite");
  assertRanClean(swapped, "self-completing rewrite");
  const d = firstDivergence(base, swapped);
  assert.equal(d, null, `the self-completing shape was not transparent — ${showDiff(d)}`);
  assert.ok(counts.get(CURSOR_STEP) > 0, "vacuous: the self-completing rewrite never dispatched");
  console.log(
    `  SEAM/self-completing: ${counts.get(CURSOR_STEP)} dispatches of ${hex4(CURSOR_STEP)} ` +
      `returned already-popped, all balanced at +2, identical over ${base.frames.length} frames`,
  );
});

test("TEETH: a rewrite that returns TWICE is REFUSED by the seam, and named", async () => {
  const { liveSpec: live } = await baselines();
  const overrides = await resolveOverrides(live.spec);
  const raw = await rawExport(live.spec, CURSOR_STEP);

  overrides.set(
    CURSOR_STEP,
    withOmittedRet((m, ...rest) => {
      const r = raw(m, ...rest);
      m.ret();
      m.ret();
      return r;
    }, CURSOR_STEP),
  );

  const broken = await run(overrides, coinPlayTape);
  assert.notEqual(
    broken.r.stopError,
    null,
    "a rewrite popping twice ran the whole game: the seam is absorbing an over-pop, which is the " +
      "one failure it exists to make impossible",
  );
  const why = String(broken.r.stopError.message);
  assert.match(why, /moved SP by 4/, `the seam threw, but not about the over-pop: ${why}`);
  assert.match(why, new RegExp(hex4(CURSOR_STEP)), `the seam threw without naming the routine: ${why}`);
  console.log(`  TEETH/rets-twice: caught at frame ${broken.r.frames} — ${why.split(".")[0]}.`);
});
