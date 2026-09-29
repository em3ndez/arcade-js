// SPDX-License-Identifier: GPL-3.0-only
/**
 * DISTANT-TAPE REACH, MAME-free. Every games/timeplt/tapes/*.poke.json declares the routines it exists
 * to put on the glass (`reaches`); tools/distant_suite.py fails a tape whose pixel window those
 * routines never ran in, but only where MAME is installed. This runs the same check without MAME,
 * on every commit: each schedule is rendered through render-lib.js -- the setup render.js uses --
 * from the exact argv distant_suite.py builds (`--print-render-argv`), so the alignment is never
 * re-derived here. Asserts, per tape: the JS side reaches the schedule's `responded` state, and
 * every declared routine runs from that frame to the end of the compared window.
 *
 * TEETH. Each declared routine has a mutant that must turn this red: an override-dispatched routine
 * is UNWIRED (its address falls back to the translated twin, so the idiomatic routine never runs);
 * a directly-called one (render-lib.js DIRECT_PROBES) is made a NO-OP in a copy of the idiomatic tree.
 * Removing a tape's pokes must also turn it red. `DISTANT_REACH_MUTANT=<routine>` applies that
 * routine's mutant to the main arm, to watch it go red.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync, cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  GAME_DIR, DIRECT_PROBES, parseRenderArgs, createRenderMachine, runGeneratorFrames,
} from "../tools/render-lib.js";
import { ROUTINES } from "../idiomatic/names.js";

const REPO = join(GAME_DIR, "..", "..");
// BYO ROM: every arm that renders needs the four regions render.js loads; without them it SKIPS.
const ROM_PRESENT = ["maincpu", "tiles", "sprites", "proms"].every((r) => existsSync(join(GAME_DIR, "rom", `${r}.bin`)));
const test = nodeTest;
const romTest = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "ROM absent at games/timeplt/rom/ (BYO)" }, fn);
const TAPES = join(GAME_DIR, "tapes");
const TAPE_FILES = readdirSync(TAPES).filter((f) => f.endsWith(".poke.json")).sort();
const SCHED = Object.fromEntries(
  TAPE_FILES.map((f) => [f, JSON.parse(readFileSync(join(TAPES, f), "utf8"))]),
);
const ADDR = new Map(Object.entries(ROUTINES).map(([a, m]) => [m.name, Number(a)]));
const int = (v) => Number(v); // "0x7d" or 125

function match(byte, op, val) {
  if (op === "eq") return byte === val;
  if (op === "ne") return byte !== val;
  if (op === "ge") return byte >= val;
  if (op === "nonzero") return byte !== 0;
  throw new Error(`unknown responded op ${op}`);
}

/** distant_suite.py's own render argv + window end for this tape (idiomatic layer). */
function suiteArgv(file) {
  const out = execFileSync(
    "python3",
    ["games/timeplt/tools/distant_suite.py", "--schedule", `games/timeplt/tapes/${file}`,
      "--layer", "idiomatic", "--print-render-argv"],
    { cwd: REPO, encoding: "utf8" },
  );
  return JSON.parse(out);
}

// ── mutant idiomatic trees: a COPY of idiomatic/ with one module edited; everything else linked ──
const trees = [];
function mutantTree(file, edit) {
  const root = mkdtempSync(join(tmpdir(), "tp-reach-"));
  trees.push(root);
  for (const e of readdirSync(REPO)) if (e !== "games") symlinkSync(join(REPO, e), join(root, e));
  const g = join(root, "games", "timeplt");
  mkdirSync(g, { recursive: true });
  for (const e of readdirSync(GAME_DIR)) if (e !== "idiomatic") symlinkSync(join(GAME_DIR, e), join(g, e));
  // Copied, not linked: the loader resolves a link to its real path, and a linked sibling would
  // import the REAL module this copy exists to replace.
  cpSync(join(GAME_DIR, "idiomatic"), join(g, "idiomatic"), { recursive: true });
  const path = join(g, "idiomatic", file);
  const before = readFileSync(path, "utf8");
  const after = edit(before);
  assert.notEqual(after, before, `mutant edit of ${file} changed nothing -- the mutant is vacuous`);
  writeFileSync(path, after);
  return pathToFileURL(join(g, "machine.js"));
}
nodeTest.after(() => { for (const t of trees) rmSync(t, { recursive: true, force: true }); });

/** A no-op body for `name`, keeping the module's other exports. */
const noOp = (name) => (src) =>
  src.replace(`export function ${name}(`, `function __replaced_${name}(`) +
  `\nexport function ${name}() { return undefined; }\n`;

/** The mutant for one declared routine: { idiomaticBase } or { editOverrides }. */
function mutantFor(name) {
  if (name in DIRECT_PROBES && DIRECT_PROBES[name].fn === name) {
    return { idiomaticBase: mutantTree(`${name}.js`, noOp(name)) };
  }
  if (name === "stepCountdownSlotThenCloseTurn") {
    // inlined into the sweep: the mutant drops the sweep's drifting-countdown arm
    return {
      idiomaticBase: mutantTree("serviceSlotByMarkerThenCloseSweepTurn.js",
        (s) => s.replace("    stepDriftingCountdownObjectByEraFrames(m);\n", "")),
    };
  }
  const addr = ADDR.get(name);
  return { editOverrides: (ov) => { assert.ok(ov.delete(addr), `${name} was not in the override map`); } };
}

/** Render one tape; return { stop, respondedAt, missing[], hits{} }. */
async function runTape(file, { mutant = {}, dropPokes = false, extraPokes = [], reachNames } = {}) {
  const sched = SCHED[file];
  const { argv, window_end: windowEnd } = suiteArgv(file);
  const args = parseRenderArgs(["node", "render.js", ...argv]);
  if (dropPokes) args.pokes = [];
  args.pokes.push(...extraPokes);
  if (reachNames) args.reach = reachNames;
  const { machine, reach } = await createRenderMachine(args, mutant);
  const r = sched.responded;
  const cell = int(r.cell), val = int(r.val), op = r.op ?? "eq";
  let respondedAt = null;
  runGeneratorFrames(machine, args.frames, args.tapeOrigin ?? 0, (i) => {
    // frame i-1's state is final here; code from now on belongs to frame i
    if (respondedAt === null && match(machine.mem8[cell], op, val)) respondedAt = i - 1;
    reach.frame = i;
  });
  const hits = {};
  const missing = [];
  for (const name of args.reach) {
    let n = 0;
    if (respondedAt !== null) {
      for (const [f, c] of reach.routines[name].hits) if (f >= respondedAt && f < windowEnd) n += c;
    }
    hits[name] = n;
    if (!n) missing.push(name);
  }
  return { stop: machine.stoppedBy ? String(machine.stoppedBy) : null, respondedAt, missing, hits, windowEnd };
}

const ENV_MUTANT = process.env.DISTANT_REACH_MUTANT || null;

test("SUITES and the tapes on disk agree, and every tape declares its reaches", () => {
  const out = execFileSync("python3", ["-c",
    "import json,sys; sys.path.insert(0,'tools'); import pixel_gate_required as g; " +
    "print(json.dumps([a[a.index('--schedule')+1] for a,_ in g.SUITES['timeplt'] if '--schedule' in a]))"],
    { cwd: REPO, encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), TAPE_FILES.map((f) => `games/timeplt/tapes/${f}`));
  assert.ok(TAPE_FILES.length > 0, "no distant tapes on disk");
  for (const f of TAPE_FILES) {
    const s = SCHED[f];
    assert.equal(`${s.name}.poke.json`, f, `${f}: schedule name must match its file`);
    assert.ok(Array.isArray(s.reaches) && s.reaches.length, `${f}: no 'reaches' declared`);
    for (const n of s.reaches) assert.ok(ADDR.has(n), `${f}: ${n} is not a routine in names.js`);
  }
});

for (const file of TAPE_FILES) {
  romTest(`${SCHED[file].name}: responded state reached and every declared routine runs from it`, async () => {
    let mutant = {};
    if (ENV_MUTANT && SCHED[file].reaches.includes(ENV_MUTANT)) mutant = mutantFor(ENV_MUTANT);
    const r = await runTape(file, { mutant });
    assert.equal(r.stop, null, `${file}: render stopped: ${r.stop}`);
    assert.notEqual(r.respondedAt, null, `${file}: JS side never satisfied 'responded'`);
    assert.deepEqual(r.missing, [], `${file}: not reached in JS frames ${r.respondedAt}..${r.windowEnd - 1}: ` +
      `${r.missing.join(", ")} (hits ${JSON.stringify(r.hits)})`);
  });
}

// Each declared routine's mutant, on the first tape that declares it, must be reported missing.
const MUTANT_CASES = new Map();
for (const f of TAPE_FILES) for (const n of SCHED[f].reaches) if (!MUTANT_CASES.has(n)) MUTANT_CASES.set(n, f);
for (const [name, file] of MUTANT_CASES) {
  romTest(`mutant: ${name} disabled -> ${SCHED[file].name} reports it NOT reached`, async () => {
    const r = await runTape(file, { mutant: mutantFor(name) });
    assert.ok(r.missing.includes(name), `mutant of ${name} still counted ${r.hits[name]} hit(s) -- the reach ` +
      "check cannot fail for it");
  });
}

romTest("control: removing a tape's pokes turns it red", async () => {
  for (const file of TAPE_FILES) {
    const r = await runTape(file, { dropPokes: true });
    const red = r.stop !== null || r.respondedAt === null || r.missing.length > 0;
    assert.ok(red, `${file}: still green with its pokes removed (responded@${r.respondedAt}, ` +
      `hits ${JSON.stringify(r.hits)}) -- the pokes are not what drives the distant state`);
  }
});

romTest("control: the inlined 0x4108 arm's probe fires on a planted drifting marker, and its mutant silences it", async () => {
  // era-advance does not reach the arm (countdown-slot does); planting a marker there proves the probe
  // fires on a planted marker and not on the unplanted tape.
  const file = "era-advance.poke.json";
  const plant = [{ addr: 0xa8c0, val: 0x20, frame: 960, dur: 1 }]; // slot 0's marker -> a drifting object
  const names = ["serviceSlotByMarkerThenCloseSweepTurn", "stepCountdownSlotThenCloseTurn"];
  const base = await runTape(file, { extraPokes: plant, reachNames: names });
  assert.ok(base.hits.stepCountdownSlotThenCloseTurn > 0, `planted marker: arm probe never fired ${JSON.stringify(base.hits)}`);
  const plain = await runTape(file, { reachNames: names });
  assert.equal(plain.hits.stepCountdownSlotThenCloseTurn, 0, "the arm is reached by the tape itself -- declare it");
  const mut = await runTape(file, { extraPokes: plant, reachNames: names, mutant: mutantFor("stepCountdownSlotThenCloseTurn") });
  assert.equal(mut.hits.stepCountdownSlotThenCloseTurn, 0, "arm mutant still counted hits");
});
