// SPDX-License-Identifier: GPL-3.0-only
//
// STANDING GATE: the live idiomatic game reads NO CPU register.
//
// Runbook §5(c) wants zero register references in the idiomatic layer. idiomatic_gate counts them in
// the source, but it exempts a `fn(m, x = m.regs.X)` parameter default -- the bridge a routine keeps for
// a register-dispatched caller in the FROZEN layer, which cannot pass named arguments. That exemption is
// blind to an IDIOMATIC caller that leaves the argument out: the default then reads whatever register
// the previous idiomatic routine left behind, and idiomatic code is passing values to itself through the
// CPU. Nothing in the source tells the two apart, so this gate asks the running game.
//
// HOW. The whole wired idiomatic machine runs under runIdiomaticGame (the shipped clock-free engine),
// with every register field of its Regs object (core/cpu/z80.js REG_FIELDS) replaced by a getter trap
// for the run. A read is charged to the first frame outside the Regs accessors and native frames, when that frame is an idiomatic module -- the pair and flag
// accessors (hl, de, fC, ...) are walked through, so `m.regs.de` is charged to its caller like
// `m.regs.e`. Two kinds of access are NOT reads, and are named so they cannot hide one:
//   * a getter called from inside a Regs SETTER -- a flag write (`m.regs.fC = x`) rewrites F from F, so
//     the write reads F first; the value handed out is never the idiomatic code's;
//   * a read whose first frame outside the Regs accessors and native frames is not an idiomatic module
//     (the boot seam in machine.js reading SP; a machine or core helper that an idiomatic module calls
//     falls here too, and none did on the coin/start/play tape).
// Every other register read by idiomatic code fails the gate. Nothing is allowed.
//
// SESSIONS: the coin/start/play tape and attract (3600 NMIs each; the input tape is test/idiomatic.test.js's, which that test runs at its own lengths), and every
// poke-driven distant state in tapes/*.poke.json, built from the exact render argv distant_suite.py uses.
// A routine that no session runs is not measured (the HOLE); the static half of the question -- an
// idiomatic call that leaves out a `= m.regs.X` argument -- is the reviewer's (reviewer-rules R37).
//
// TEETH. Four mutants, each on a copied idiomatic tree, each must be heard: a scenery step that leaves
// its cursors out (IX/IY read through the bridge, the tape), a round caption that leaves its character
// cursor out (DE, a pair accessor, a distant state), and a flag READ riding a flag write (F through the
// fC accessor) -- so the setter carve-out cannot swallow a real flag read. A fourth copies the register
// file with Object.assign, so a read made from a native frame is still charged to the idiomatic caller.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { REG_FIELDS } from "../../../core/cpu/z80.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import {
  GAME_DIR, parseRenderArgs, createRenderMachine, runGeneratorFrames, idiomaticTree,
} from "../tools/render-lib.js";

const REPO = join(GAME_DIR, "..", "..");
const ROM_PRESENT = ["maincpu", "tiles", "sprites", "proms"].every((r) => existsSync(join(GAME_DIR, "rom", `${r}.bin`)));
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "ROM absent at games/timeplt/rom/ (BYO)" }, fn);

const NMIS = 3600;
const TAPE_FILES = readdirSync(join(GAME_DIR, "tapes")).filter((f) => f.endsWith(".poke.json")).sort();

// The coin/start/play tape of test/idiomatic.test.js, in NMI ordinals.
const { actions } = manifest.inputs;
const COIN_AT = 100, START_AT = 160, PLAY_FROM = 220, HOLD = 8, TURN = 97, FIRE_EVERY = 23, FIRE_FOR = 7;
const DIRECTIONS = [actions.up, actions.right, actions.down, actions.left];
function inputAt(n, live) {
  if (!live) return null;
  const a = {};
  const press = (act) => { a[act.port] = (a[act.port] || 0) | act.bit; };
  if (n >= COIN_AT && n < COIN_AT + HOLD) press(actions.coin);
  if (n >= START_AT && n < START_AT + HOLD) press(actions.start1);
  if (n >= PLAY_FROM) {
    press(DIRECTIONS[Math.floor((n - PLAY_FROM) / TURN) % 4]);
    if ((n - PLAY_FROM) % FIRE_EVERY < FIRE_FOR) press(actions.fire);
  }
  return a;
}

// ── the instrument ──────────────────────────────────────────────────────────────────────────

const IDIOMATIC_FRAME = /\/games\/timeplt\/idiomatic\/(\w+\.js):(\d+)/;
const REGS_FRAME = /\/core\/cpu\/z80\.js:/;
const SETTER_FRAME = /at (?:Regs\.)?set \w+ /;

/**
 * Replace every register field of `m.regs` with a getter trap. Returns the tally the run fills:
 * reads (idiomatic "module:line reg" -> count), setterReads (flag-write read-modify-writes, counted
 * only to show the carve-out is exercised), and arm/disarm switches.
 */
function trapRegisters(m) {
  const tally = { reads: new Map(), setterReads: 0, armed: false };
  for (const k of REG_FIELDS) {
    // Most fields are width-masking accessors on the Regs prototype; the trap delegates to them, so the
    // run observes the shipped masked behaviour rather than a plain unmasked slot.
    const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m.regs), k);
    let value = m.regs[k];
    Object.defineProperty(m.regs, k, {
      configurable: true,
      enumerable: true,
      get() {
        if (tally.armed) {
          const frames = new Error().stack.split("\n").slice(2);
          if (frames.length && SETTER_FRAME.test(frames[0]) && REGS_FRAME.test(frames[0])) {
            tally.setterReads++;
          } else {
            // Walk out through the Regs accessors (hl, de, fC, ...) to the code that asked.
            const at = frames.find((f) => !REGS_FRAME.test(f) && !f.includes("(<anonymous>)"));
            const hit = at && at.match(IDIOMATIC_FRAME);
            if (hit) {
              const key = `${hit[1]}:${hit[2]} ${k}`;
              tally.reads.set(key, (tally.reads.get(key) ?? 0) + 1);
            }
          }
        }
        return proto ? proto.get.call(this) : value;
      },
      set(v) { if (proto) proto.set.call(this, v); else value = v; },
    });
  }
  return tally;
}

/** Run the coin/start/play tape (`live`) or attract from reset on the tree `machineUrl`. */
async function runTape(live, machineUrl = new URL("../machine.js", import.meta.url)) {
  const layer = await import(machineUrl.href);
  const overrides = await layer.resolveAllIdiomatic(machineUrl);
  const rom = new Uint8Array(readFileSync(join(GAME_DIR, "rom", "maincpu.bin")));
  const m = await layer.Machine.create(rom, { overrides });
  const tally = trapRegisters(m);
  tally.armed = true;
  const r = runIdiomaticGame(m, {
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: NMIS,
    onFrame: (mm, f) => {
      tally.armed = false;
      if (f >= 1) mm.io.inputAssert = inputAt(f - 1, live);
      tally.armed = true;
    },
  });
  tally.armed = false;
  return { tally, frames: r.frames, stop: r.stopError ?? null };
}

/** distant_suite.py's own render argv for this schedule (idiomatic layer). */
function suiteArgv(file) {
  const out = execFileSync(
    "python3",
    ["games/timeplt/tools/distant_suite.py", "--schedule", `games/timeplt/tapes/${file}`,
      "--layer", "idiomatic", "--print-render-argv"],
    { cwd: REPO, encoding: "utf8" },
  );
  const drop = new Set(["--frames-out", "--reach", "--reach-out"]);
  return JSON.parse(out).argv.filter((x, i, a) => !drop.has(x) && !drop.has(a[i - 1]));
}

/** Run one distant schedule's render session, optionally on a mutated idiomatic tree. */
async function runDistant(file, idiomaticEdits) {
  const args = parseRenderArgs(["node", "render.js", ...suiteArgv(file)]);
  const { machine: m } = await createRenderMachine({ ...args, reach: [] }, { idiomaticEdits });
  m.captureVideo = false;
  const tally = trapRegisters(m);
  tally.armed = true;
  const states = runGeneratorFrames(m, args.frames, args.tapeOrigin ?? 0);
  tally.armed = false;
  return { tally, frames: states.length, want: args.frames, stop: m.stoppedBy };
}

const show = (tally) => [...tally.reads].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} x${n}`).join("; ");

// ── the gate ────────────────────────────────────────────────────────────────────────────────

for (const [label, live] of [["coin/start/play tape", true], ["attract", false]]) {
  test(`${label}: no idiomatic module reads a CPU register (${NMIS} NMIs)`, async () => {
    const { tally, frames, stop } = await runTape(live);
    assert.equal(stop, null, `the run stopped early: ${stop}`);
    assert.equal(frames, NMIS, "the run did not reach its NMI budget");
    assert.equal(tally.reads.size, 0, `idiomatic code read registers: ${show(tally)}`);
    // Attract's drifting objects make flag writes (hasReachedHorizontalEdgeWindow's carry), so the
    // setter carve-out is met there and a green run is not green by never meeting one.
    if (!live) assert.ok(tally.setterReads > 0, "no flag write was seen, so the setter carve-out was never tested");
  });
}

for (const file of TAPE_FILES) {
  test(`distant ${file}: no idiomatic module reads a CPU register`, async () => {
    const { tally, frames, want, stop } = await runDistant(file);
    assert.equal(stop, null, `the run stopped early: ${stop}`);
    assert.equal(frames, want, "the run did not reach its frame budget");
    assert.equal(tally.reads.size, 0, `idiomatic code read registers: ${show(tally)}`);
  });
}

// ── teeth: each mutant reintroduces one register read and must be heard ─────────────────────

const edit = (from, to) => (src) => src.replace(from, to);

test("TEETH: a scenery step that leaves its cursors out is heard (IX/IY, the tape)", async () => {
  const tree = idiomaticTree({ edits: {
    "driftTwoTileSceneryAtThreeQuarters.js": edit("return advanceToNextSlot(m, tileRecord, tileEntry);", "return advanceToNextSlot(m);"),
  } });
  const { tally } = await runTape(true, tree.machine);
  const keys = [...tally.reads.keys()];
  assert.ok(keys.some((k) => k.startsWith("advanceToNextSlot.js:") && k.endsWith(" ix")), `IX read not heard: ${keys.join(", ")}`);
  assert.ok(keys.some((k) => k.startsWith("advanceToNextSlot.js:") && k.endsWith(" iy")), `IY read not heard: ${keys.join(", ")}`);
});

test("TEETH: a round caption that leaves its cursor out is heard (DE through the pair accessor, a distant state)", async () => {
  const { tally } = await runDistant(TAPE_FILES[0], {
    "drawRoundNumberCaption.js": edit("cursor = retreatCharCursor(m, cursor);", "cursor = retreatCharCursor(m);"),
  });
  const keys = [...tally.reads.keys()];
  assert.ok(keys.some((k) => k.startsWith("retreatCharCursor.js:") && (k.endsWith(" d") || k.endsWith(" e"))),
    `DE read not heard: ${keys.join(", ")}`);
});

test("TEETH: a flag read beside a flag write is heard (F through the fC accessor)", async () => {
  const tree = idiomaticTree({ edits: {
    "hasReachedHorizontalEdgeWindow.js": edit("return (m.regs.fC = arrived);", "void m.regs.fC; return (m.regs.fC = arrived);"),
  } });
  const { tally } = await runTape(false, tree.machine);
  const keys = [...tally.reads.keys()];
  assert.ok(keys.some((k) => k.startsWith("hasReachedHorizontalEdgeWindow.js:") && k.endsWith(" f")), `F read not heard: ${keys.join(", ")}`);
});

test("TEETH: a register-file copy made through a native frame is heard (Object.assign, attract)", async () => {
  const tree = idiomaticTree({ edits: {
    "hasReachedHorizontalEdgeWindow.js": edit("return (m.regs.fC = arrived);", "void Object.assign({}, m.regs); return (m.regs.fC = arrived);"),
  } });
  const { tally } = await runTape(false, tree.machine);
  const keys = [...tally.reads.keys()];
  assert.ok(keys.some((k) => k.startsWith("hasReachedHorizontalEdgeWindow.js:") && k.endsWith(" a")), `Object.assign read not heard: ${keys.join(", ")}`);
});
