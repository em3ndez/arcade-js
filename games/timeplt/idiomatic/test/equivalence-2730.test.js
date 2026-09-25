// SPDX-License-Identifier: GPL-3.0-only
/**
 * verifyImageSignatureThenStartAttractDemoOrDerail — memory-equivalent to the frozen oracle at ROM
 * 0x2730, a phase-1 attract sub-step arm (inner sub-step 12 of the phase-1 dispatch table).
 *
 * WHAT IT IS. It reads the folded program-image signature the self-check banked at
 * TAMPER_IMAGE_SIGNATURE and compares it against 0x76. On a tampered image it DERAILS into the
 * power-on wipe trap (loc_2530, data run as code). On a genuine image — where the signature always
 * reads 0x76 — it starts the attract-mode autopilot demo: park the caption sprites, seed the demo
 * autopilot script, clear the two-player flag / player-two lives / play-active flag / inner
 * sub-step, stock player one with one life, and wind the outer sequence on to its last phase (3).
 *
 * ★ WHERE THE LIVE-OUT COMES FROM. The arm is reached by computed dispatch off the phase-1 table
 *   and the phase-3 successor reloads every register it uses before reading one, so NO register is
 *   live out and the live-out is memory only — the same finding as the sibling arms 0x176a / 0x178c.
 *   The register ceiling below is MEASURED (the set the faithful rewrite actually diverges on,
 *   dominated by the callee ABI: the oracle reaches its two callees through push16/m.call and takes
 *   a ROM ret at the end, the dissolved arm calls them directly and omits the ret), not asserted —
 *   a rewrite that moves fewer still passes, so it can never refuse a fix.
 *
 * ★ THE ORACLE PUSHES AND THE REWRITE DOES NOT. The oracle seats a return before each of its two
 *   calls, 2 bytes below its seat, and takes a ROM ret at the end (SP += 2). The dissolved arm calls
 *   the idiomatic callees directly and returns for the withOmittedRet seam to complete. The window
 *   the oracle's own pushes reach is MEASURED and PINNED, never assumed.
 *
 * ★ ONE NATURAL DISPATCH. An undriven attract session dispatches this arm exactly once (~frame 554),
 *   on a genuine image, so the signature reads 0x76 and the genuine path is taken. The derail is
 *   unreachable in normal play, so it is exercised by poking the signature identically on both sides.
 *
 * What it exercises, holes stated:
 *   1. EQUAL      — identical across the whole state dump outside the measured window, at the one
 *                   natural dispatch.
 *   2. REACHED    — attract dispatches the arm and the harness produces a verdict.
 *   3. WINDOW     — the oracle's own deepest push, measured and PINNED.
 *   4. BOUNDARY   — a planted divergence one byte BELOW the window is caught, one AT the seat is
 *                   caught, one INSIDE is masked.
 *   5. EXCLUDED   — no register outside the declared ceiling moves, with an index-scribbling control.
 *   6. STARTS     — on a poisoned entry the arm parks the sprites, seeds the demo, clears the four
 *                   cells, stocks one life and winds the phase to 3.
 *   7. DERAIL     — a tampered signature takes the power-on wipe trap identically on both sides, and
 *                   a twin that starts the demo instead of derailing is caught there.
 *   8. TEETH      — twins, each caught.
 *
 * HOLE: the two callees are gated by their own files (equivalence for hideCaptionSprites and
 * seedDemoAutopilotScript). What this file gates is that both are reached and which cells the arm
 * itself writes.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2730.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { verifyImageSignatureThenStartAttractDemoOrDerail } from "../verifyImageSignatureThenStartAttractDemoOrDerail.js";
import { hideCaptionSprites } from "../hideCaptionSprites.js";
import { seedDemoAutopilotScript } from "../seedDemoAutopilotScript.js";
import { loc_2530 } from "../../translated/loc_2530.js";
import { loc_2730 as oracle } from "../../translated/loc_2730.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import {
  TAMPER_IMAGE_SIGNATURE,
  TWO_PLAYER_GAME,
  PLAYER_TWO_LIVES,
  PLAY_ACTIVE,
  SEQUENCE_SUBSTEP,
  PLAYER_ONE_LIVES,
  SEQUENCE_PHASE,
  PLAYER_SPRITE_Y,
} from "../names.js";

const TARGET = 0x2730;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const EXPECTED_SIGNATURE = 0x76;
const DEMO_PHASE = 0x03;
const DEMO_LIVES = 0x01;

/** The four caption-sprite Y cells hideCaptionSprites clears (base, stride 2). */
const CAPTION_CELLS = [0, 2, 4, 6].map((o) => PLAYER_SPRITE_Y + o);

/** Measured & PINNED by the WINDOW arm: the deepest the oracle's own pushes reach below its seat. */
const SCRATCH_BYTES = 2;

/**
 * The ceiling on register divergence, MEASURED as the set a faithful rewrite diverges on (the
 * callee ABI plus the omitted ret), not the module header. A rewrite that moves fewer still passes.
 */
const MOVED = ["a", "f", "b", "d", "e", "h", "l", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => {
  if (!d) return "identical";
  return d.addr === null || d.addr === undefined
    ? `${d.reg}: oracle=${d.a} candidate=${d.b}`
    : `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}`;
};

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** The masked window: bytes the oracle's own pushes reach, and no others. */
const inScratch = (addr, sp) => addr !== null && addr !== undefined && addr >= sp - SCRATCH_BYTES && addr < sp;

/**
 * Oracle vs candidate on clones of `machine`: the whole dump masked to the measured window, then
 * every register outside the ceiling. Only the candidate is wrapped — a raise from the oracle is a
 * harness fault and must not be swallowed. A candidate raise where the oracle returned is a diff.
 */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, reg: "raised", a: "returned", b: String(e.message ?? e).slice(0, 40) };
  }
  const ram = allDiffs(a, b).find((d) => !inScratch(d.addr, sp));
  if (ram) return ram;
  for (const k of REG_FIELDS) {
    if (MOVED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/** How far below its seat the oracle's own pushes take the stack pointer, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  try {
    oracle(c);
  } catch {
    // a derail arm may raise; the depth up to that point counts.
  }
  return seat - deepest;
}

// ── the captured corpus ─────────────────────────────────────────────────────────────────

let corpus = null;

/** One pristine machine per dispatch of an undriven attract session. Nothing is poked. */
function captureCorpus() {
  if (corpus) return corpus;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape: [] });
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `corpus run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "corpus run ran short");
  assert.ok(entries.length > 0, "vacuous: attract never reached the routine");
  corpus = entries;
  return corpus;
}

/** The one natural (genuine) dispatch. */
function genuineEntry() {
  const e = captureCorpus().find((mm) => mm.mem8[TAMPER_IMAGE_SIGNATURE] === EXPECTED_SIGNATURE);
  assert.notEqual(e, undefined, "vacuous: no captured dispatch presents a genuine signature");
  return e;
}

// ── broken twins (built the way the module is built — direct callee calls) ────────────────

function brokenNoOp() {}

/** A body that starts the demo but leaves the named store out; `omit` names the skipped store. */
function makeStarter(omit) {
  return (m) => {
    const { mem8 } = m;
    const signature = mem8[TAMPER_IMAGE_SIGNATURE];
    if (signature !== EXPECTED_SIGNATURE) {
      m.regs.a = signature;
      m.regs.cp(EXPECTED_SIGNATURE);
      return loc_2530(m);
    }
    if (omit !== "hide") hideCaptionSprites(m);
    if (omit !== "seed") seedDemoAutopilotScript(m);
    if (omit !== "two-player") mem8[TWO_PLAYER_GAME] = 0;
    if (omit !== "p2-lives") mem8[PLAYER_TWO_LIVES] = 0;
    if (omit !== "play-active") mem8[PLAY_ACTIVE] = 0;
    if (omit !== "substep") mem8[SEQUENCE_SUBSTEP] = 0;
    if (omit !== "lives") mem8[PLAYER_ONE_LIVES] = DEMO_LIVES;
    if (omit === "wrong-phase") mem8[SEQUENCE_PHASE] = DEMO_PHASE ^ 0x01;
    else if (omit !== "phase") mem8[SEQUENCE_PHASE] = DEMO_PHASE;
  };
}

/** scribbles an index register, the in-arm control for the ceiling. */
function brokenMovesIndex(m) {
  verifyImageSignatureThenStartAttractDemoOrDerail(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

// The stores the clean corpus entry does not already satisfy are caught directly; the "clear"
// stores land on cells the entry already holds at 0, so they get a poisoned entry (see TEETH).
const TWINS_NEED_POISON = new Set(["two-player", "p2-lives", "play-active"]);
const TWINS = [
  ["no-op", brokenNoOp],
  ["skip-hide", makeStarter("hide")],
  ["skip-seed", makeStarter("seed")],
  ["skip-substep-clear", makeStarter("substep")],
  ["wrong-lives", makeStarter("lives")],
  ["wrong-phase", makeStarter("wrong-phase")],
  ["skip-phase", makeStarter("phase")],
  ["skip-two-player-clear", makeStarter("two-player")],
  ["skip-p2-lives-clear", makeStarter("p2-lives")],
  ["skip-play-active-clear", makeStarter("play-active")],
];

/** Poison the six cells the genuine path writes, so every store is observable. */
function poison(e) {
  const m = e.clone();
  m.mem8[TWO_PLAYER_GAME] = 0xee;
  m.mem8[PLAYER_TWO_LIVES] = 0xee;
  m.mem8[PLAY_ACTIVE] = 0xee;
  m.mem8[SEQUENCE_SUBSTEP] = 0xee;
  m.mem8[PLAYER_ONE_LIVES] = 0xee;
  m.mem8[SEQUENCE_PHASE] = 0xee;
  for (const c of CAPTION_CELLS) m.mem8[c] = 0xee;
  return m;
}

/** The BOUNDARY probe: the ORACLE ITSELF, plus one byte flipped at sp + offset. */
function scribbler(offset) {
  return (m) => {
    const at = (m.regs.sp + offset) & 0xffff;
    oracle(m);
    m.mem8[at] ^= 0xff;
  };
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the natural dispatch: identical outside the measured window", { skip }, () => {
  const e = genuineEntry();
  const sp = e.regs.sp;
  const a = e.clone();
  const b = e.clone();
  oracle(a);
  verifyImageSignatureThenStartAttractDemoOrDerail(b);
  const all = allDiffs(a, b);
  const strays = all.filter((d) => !inScratch(d.addr, sp));
  console.log(`  EQUAL: seat ${hex4(sp)}; ${all.length} differing bytes, ${strays.length} outside the window`);
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  assert.ok(all.length <= SCRATCH_BYTES, "more bytes differ than the window is wide");
});

test("REACHED: attract dispatches the routine and the harness agrees", { skip }, () => {
  const attractFactory = (overrides) => makeMachine(overrides, { tape: [] });
  const r = unitEquivalence(attractFactory, TARGET, oracle, verifyImageSignatureThenStartAttractDemoOrDerail, {
    maxFrames: ENTRY_FRAMES,
  });
  assert.notEqual(r.pc, undefined, "the harness returned no verdict — the routine was never reached");
  console.log("  REACHED: the undriven attract session dispatches the routine and it runs to a verdict");
});

test("WINDOW: the oracle's own deepest push, measured over the corpus", { skip }, () => {
  let deepest = 0;
  for (const m of captureCorpus()) deepest = Math.max(deepest, oracleDepth(m));
  console.log(`  WINDOW (measured): the oracle reaches ${deepest} bytes below its seat`);
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved, so the masked window " +
    "is no longer the measured one");
});

test("BOUNDARY: the exclusion is exactly as wide as it declares", { skip }, () => {
  const at = genuineEntry();
  const sp = at.regs.sp;
  const below = unitDiff(scribbler(-SCRATCH_BYTES - 1), at);
  const seat = unitDiff(scribbler(0), at);
  const inside = unitDiff(scribbler(-1), at);
  console.log(`  BOUNDARY: ${hex4(sp - SCRATCH_BYTES - 1)} caught, ${hex4(sp)} caught, ${hex4(sp - 1)} masked`);
  assert.notEqual(below, null, "a divergence one byte BELOW the window was swallowed");
  assert.notEqual(seat, null, "a divergence AT the entry seat was swallowed");
  assert.equal(inside, null, "a divergence INSIDE the window was caught, so the boundary is not where it says");
});

test("EXCLUDED, deliberately: no register outside the ceiling moves", { skip }, () => {
  const movedOver = (candidate) => {
    const moved = new Set();
    for (const m of captureCorpus()) {
      const a = m.clone();
      const b = m.clone();
      oracle(a);
      try {
        candidate(b);
      } catch {
        continue;
      }
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    }
    return moved;
  };
  const moved = movedOver(verifyImageSignatureThenStartAttractDemoOrDerail);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for an index-scribbling twin");
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")} — ` +
    `ceiling ${MOVED.join(", ")}`);
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register outside the declared ceiling diverged");
});

test("STARTS: the arm parks sprites, seeds the demo, clears the cells and winds the phase", { skip }, () => {
  const e = poison(genuineEntry());
  assert.equal(e.mem8[TAMPER_IMAGE_SIGNATURE], EXPECTED_SIGNATURE, "vacuous: this entry is not genuine");
  const m = e.clone();
  verifyImageSignatureThenStartAttractDemoOrDerail(m);
  assert.ok(CAPTION_CELLS.every((c) => m.mem8[c] === 0), "the caption sprites were not parked");
  assert.equal(m.mem8[TWO_PLAYER_GAME], 0, "the two-player flag was not cleared");
  assert.equal(m.mem8[PLAYER_TWO_LIVES], 0, "player two's lives were not cleared");
  assert.equal(m.mem8[PLAY_ACTIVE], 0, "the play-active flag was not cleared");
  assert.equal(m.mem8[SEQUENCE_SUBSTEP], 0, "the inner sub-step was not cleared");
  assert.equal(m.mem8[PLAYER_ONE_LIVES], DEMO_LIVES, "player one was not stocked with one life");
  assert.equal(m.mem8[SEQUENCE_PHASE], DEMO_PHASE, "the outer sequence was not wound to its last phase");
  // the demo autopilot seed cells were written (not left poisoned) — the seed step ran
  const seeded = e.clone();
  seedDemoAutopilotScript(seeded);
  const oracleOut = e.clone();
  oracle(oracleOut);
  assert.deepEqual(allDiffs(oracleOut, m).filter((d) => !inScratch(d.addr, e.regs.sp)), [],
    "the poisoned start diverged from the oracle outside the window");
  console.log("  STARTS: sprites parked, four cells cleared, one life, phase -> 3, oracle-exact");
});

test("DERAIL: a tampered signature takes the power-on wipe trap identically on both sides", { skip }, () => {
  const e = genuineEntry().clone();
  e.mem8[TAMPER_IMAGE_SIGNATURE] = (EXPECTED_SIGNATURE + 1) & 0xff; // move the signature off 0x76

  const a = e.clone();
  const b = e.clone();
  let oracleErr = null;
  let candErr = null;
  try { oracle(a); } catch (err) { oracleErr = String(err.message ?? err); }
  try { verifyImageSignatureThenStartAttractDemoOrDerail(b); } catch (err) { candErr = String(err.message ?? err); }
  assert.equal(candErr, oracleErr, `the derail arm diverged: oracle=${oracleErr} candidate=${candErr}`);
  if (oracleErr === null) {
    const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, e.regs.sp));
    assert.deepEqual(strays, [], `the derail arm's state diverged: ${show(strays[0])}`);
  }
  // the trap must NOT wind the sequence phase to 3 — the demo start path is not taken.
  assert.notEqual(b.mem8[SEQUENCE_PHASE], DEMO_PHASE, "the derail arm still started the demo");

  // A twin that starts the demo instead of derailing is CAUGHT here.
  const noDerailTwin = (m) => {
    const { mem8 } = m;
    hideCaptionSprites(m);
    seedDemoAutopilotScript(m);
    mem8[TWO_PLAYER_GAME] = 0;
    mem8[PLAYER_TWO_LIVES] = 0;
    mem8[PLAY_ACTIVE] = 0;
    mem8[SEQUENCE_SUBSTEP] = 0;
    mem8[PLAYER_ONE_LIVES] = DEMO_LIVES;
    mem8[SEQUENCE_PHASE] = DEMO_PHASE;
  };
  const c = e.clone();
  let twinErr = null;
  try { noDerailTwin(c); } catch (err) { twinErr = String(err.message ?? err); }
  assert.notEqual(twinErr, oracleErr, "the no-derail twin was NOT caught: it must not match the trap");
  console.log(`  DERAIL: tampered signature => oracle ${oracleErr ? "trap" : "seat"}; the no-derail twin is caught`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const base = genuineEntry();
    const e = TWINS_NEED_POISON.has(label.replace(/^skip-|-clear$/g, "")) ? poison(base) : base;
    const d = unitDiff(twin, e);
    console.log(`  TEETH/${label}: ${show(d)}`);
    assert.notEqual(d, null, `the masked comparison PASSED the ${label} twin`);
  });
}
