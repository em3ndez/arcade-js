// SPDX-License-Identifier: GPL-3.0-only
/**
 * The importable half of render.js: argv -> machine setup, the generator-engine frame loop, and the
 * REACH instrument. render.js (the pixel gate's JS side) and test/distant-reach-tape.test.js both
 * build their machine HERE, so the standing test runs a schedule through exactly the setup and
 * frame alignment the pixel render uses -- nothing is re-derived by hand.
 *
 * REACH. A distant tape declares the routines it exists to put on the glass (`reaches` in the
 * schedule). A pixel PASS says the frames agree; it does not say those routines ran. The instrument
 * counts, per painted frame, each declared routine's executions:
 *   - idiomatic: counted at the routine's OWN BODY, however it is entered -- an override-map dispatch,
 *     a direct call from another idiomatic module (a dispatcher's switch, a sweep), or a call from the
 *     vblank handler machine.js fires directly. The layer is loaded from a COPY of idiomatic/ (plus
 *     machine.js, so the NMI subtree runs the copy too) whose declared routines open with one counter
 *     statement; nothing else in the copy differs. An unwired routine (its address falling back to the
 *     translated twin) that no idiomatic module calls counts nothing; a body that never runs counts
 *     nothing.
 *   - oracle: the routine map entry is wrapped and every dispatch counts.
 *   - an ARM the ROM inlines into another routine (no function of its own ever runs): attributed by the
 *     host call stack on a probe read the arm's body makes (DIRECT_PROBES).
 */

import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Machine } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import { parseEmitArgs } from "../../../tools/emit-core.js";
import { ROUTINES } from "../idiomatic/names.js";

export const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/timeplt
const REPO = join(GAME_DIR, "..", "..");

const ROM_SIZES = { tiles: 0x2000, sprites: 0x4000, proms: 0x0240 };

function loadRegion(name, path) {
  const buf = new Uint8Array(readFileSync(path));
  if (buf.length !== ROM_SIZES[name]) {
    throw new Error(
      `${name}: ${path} is ${buf.length} bytes, expected ${ROM_SIZES[name]} — ` +
        "a wrong or partial region renders a plausible, wrong image rather than failing",
    );
  }
  return buf;
}

/** render.js's argv (process.argv shape: two leading entries) -> args. */
export function parseRenderArgs(argv) {
  return parseEmitArgs(argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      tiles: join(GAME_DIR, "rom", "tiles.bin"),
      sprites: join(GAME_DIR, "rom", "sprites.bin"),
      proms: join(GAME_DIR, "rom", "proms.bin"),
      frames: 1802,
      framesOut: join(GAME_DIR, "out", "render"),
      reach: [],
      reachOut: null,
    },
    extra: (flag, next, a) => {
      switch (flag) {
        case "--tiles": a.tiles = next(); return true;
        case "--sprites": a.sprites = next(); return true;
        case "--proms": a.proms = next(); return true;
        case "--frames-out": a.framesOut = next(); return true;
        case "--idiomatic": a.idiomatic = true; return true;
        case "--tape-origin": a.tapeOrigin = Number(next()); return true;
        case "--reach": a.reach = next().split(",").map((s) => s.trim()).filter(Boolean); return true;
        case "--reach-out": a.reachOut = next(); return true;
        default: return false;
      }
    },
  });
}

/**
 * Build the machine the args describe, with the reach instrument installed when `args.reach` names
 * routines. `idiomaticEdits` (tests only) is { "<module>.js": (src) => src } applied to the copied
 * idiomatic tree -- the mutants in test/distant-reach-tape.test.js; `editOverrides` (tests only) edits
 * the resolved override map. Returns { machine, reach } (reach null when not asked).
 */
export async function createRenderMachine(args, { idiomaticEdits, editOverrides } = {}) {
  const gfx = {
    tiles: loadRegion("tiles", args.tiles),
    sprites: loadRegion("sprites", args.sprites),
    proms: loadRegion("proms", args.proms),
  };
  const romImage = new Uint8Array(readFileSync(args.rom));
  const reach = args.reach?.length ? new Reach(args.reach, args.idiomatic ? "idiomatic" : "oracle") : null;
  let machine;
  if (args.idiomatic) {
    const tree = reach || idiomaticEdits
      ? idiomaticTree({ edits: idiomaticEdits, counted: reach ? Object.keys(reach.routines) : [] })
      : null;
    const layer = await import(tree ? tree.machine.href : new URL("../machine.js", import.meta.url).href);
    const overrides = await layer.resolveAllIdiomatic();
    if (editOverrides) editOverrides(overrides);
    if (reach) await reach.attachTree(tree);
    machine = await layer.Machine.create(romImage, { ...gfx, overrides });
  } else {
    if (idiomaticEdits) throw new Error("idiomaticEdits: the oracle layer runs no idiomatic module");
    const routines = buildRoutines();
    if (reach) reach.wrapMap(routines);
    machine = new Machine(romImage, routines, gfx);
  }
  if (reach) reach.installProbes(machine);
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;
  return { machine, reach };
}

// ── the copied idiomatic tree the idiomatic reach runs ─────────────────────────────────────────

const ENTRY_HOOK = "__reach_entry.js";
const trees = [];
process.on("exit", () => { for (const t of trees) rmSync(t, { recursive: true, force: true }); });

/**
 * Insert `stmt` as the first statement of `export function[*] name(...) {` in `src`. The parameter
 * list is skipped by paren depth (a default like `x = m.regs.ix` holds none, a call default would).
 * Fails closed: a routine the instrument cannot open is an error, never a silent zero.
 */
export function openBodyWith(src, name, stmt) {
  const re = new RegExp(`^export function\\*?\\s*${name}\\s*\\(`, "gm");
  const found = [...src.matchAll(re)];
  if (found.length !== 1) {
    throw new Error(`reach: ${name}.js must declare \`export function ${name}(\` exactly once (found ${found.length})`);
  }
  let i = found[0].index + found[0][0].length;
  for (let depth = 1; depth > 0; i++) {
    if (i >= src.length) throw new Error(`reach: ${name}: unbalanced parameter list`);
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
  }
  const open = src.slice(i).search(/\S/);
  if (open < 0 || src[i + open] !== "{") throw new Error(`reach: ${name}: no body after the parameter list`);
  const at = i + open + 1;
  return src.slice(0, at) + ` ${stmt}` + src.slice(at);
}

/**
 * A copy of the repo view whose games/timeplt/idiomatic/ and games/timeplt/machine.js are real
 * copies and everything else is a link. Copied, not linked: the loader resolves a link to its real
 * path, and a linked sibling would import the REAL module the copy exists to replace. machine.js is
 * copied because it imports the vblank handler directly (the NMI subtree never passes through the
 * override map); a linked machine.js would run the REAL tree under the NMI. Each `counted` routine's
 * body opens with a hit on the tree's entry hook FIRST, then `edits` apply -- so a mutant that
 * replaces a body drops the counter with it.
 */
export function idiomaticTree({ edits = {}, counted = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tp-idiomatic-"));
  trees.push(root);
  for (const e of readdirSync(REPO)) if (e !== "games") symlinkSync(join(REPO, e), join(root, e));
  const g = join(root, "games", "timeplt");
  mkdirSync(g, { recursive: true });
  for (const e of readdirSync(GAME_DIR)) {
    if (e !== "idiomatic" && e !== "machine.js") symlinkSync(join(GAME_DIR, e), join(g, e));
  }
  cpSync(join(GAME_DIR, "machine.js"), join(g, "machine.js"));
  cpSync(join(GAME_DIR, "idiomatic"), join(g, "idiomatic"), { recursive: true });
  const dir = join(g, "idiomatic");
  writeFileSync(join(dir, ENTRY_HOOK), "// reach instrument (render-lib.js): set per tree\nexport const entryHook = { hit: null };\n");
  for (const name of counted) {
    const path = join(dir, `${name}.js`);
    const src = readFileSync(path, "utf8");
    writeFileSync(path, openBodyWith(src, name, `__reachEntry.hit(${JSON.stringify(name)});`) +
      `\nimport { entryHook as __reachEntry } from "./${ENTRY_HOOK}";\n`);
  }
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(dir, file);
    const before = readFileSync(path, "utf8");
    const after = edit(before);
    if (after === before) throw new Error(`idiomaticTree: the edit of ${file} changed nothing -- a vacuous mutant`);
    writeFileSync(path, after);
  }
  return { root, machine: pathToFileURL(join(g, "machine.js")), hook: pathToFileURL(join(dir, ENTRY_HOOK)) };
}

/**
 * Paint `want` frames of the idiomatic game under runIdiomaticGame.
 *
 * PAINTED WHOLE AT THE VBLANK YIELD: there is no beam on this clock, and the cycle-driven painter
 * publishes on a boundary this engine sets to Infinity. ⚠ The whole-frame tolerance does NOT settle
 * which instant to snapshot -- yield 1324px and post-NMI 2810px BOTH sit inside 5%. The band check
 * does: 33px/0 over at the yield against 1571px/1278 over post-NMI. Pick on the band.
 * `afterFrame(i)` runs once frame i-1 is out, so code after it belongs to frame index i.
 */
export function runGeneratorFrames(machine, want, tapeOrigin, afterFrame = null) {
  const states = [];
  machine.startBeamFrame(); // open frame 1's band buffer before the boot foreground runs
  const r = runIdiomaticGame(machine, {
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: want,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on, before the boot generator runs: no golden frame matches it
      m.applyInputs(f + tapeOrigin);
      m.applyPokes(f + tapeOrigin);
      states.push(m.mem.dumpState());
      if (m.onVideoFrame) m.onVideoFrame(m.finishBeamFrame());
      m.startBeamFrame(); // open the next frame's band buffer
      if (afterFrame) afterFrame(states.length);
    },
  });
  machine.stoppedBy = r.stopError ?? null;
  return states;
}

const NAME_TO_ADDR = new Map(Object.entries(ROUTINES).map(([a, meta]) => [meta.name, Number(a)]));
const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;

/**
 * ARMS the ROM inlines into another routine, so no function of their own runs for the body-entry
 * count to see: attributed by the host call stack on a read the arm's body makes -- `fn` must be the
 * innermost idiomatic frame of the read, and every `under` entry (if given) must be the name of SOME
 * frame on the stack. `cell(m, a)` pre-filters reads so a stack is captured only where the probe can
 * fire.
 *
 * ★ stepCountdownSlotThenCloseTurn (0x4108) is INLINED into serviceSlotByMarkerThenCloseSweepTurn
 * (0x40ea): its ROM body is the sweep's drifting-countdown arm, reached as a call into
 * stepDriftingCountdownObjectByEraFrames from the sweep. That ARM is what is counted -- the 0x4108
 * module's own body is also counted, so a direct entry of it counts too.
 */
export const DIRECT_PROBES = {
  stepCountdownSlotThenCloseTurn: {
    cell: (m, a) => a === (m.regs.ix & 0xffff), // the object's countdown byte
    fn: "stepDriftingCountdownObjectByEraFrames",
    under: ["serviceSlotByMarkerThenCloseSweepTurn", "stepCountdownSlotThenCloseTurn"],
  },
};

const FRAME_RE = /^\s*at (?:async )?([^\s(]+) \((.*)\)$/;

/** Innermost idiomatic function name on a stack, and the set of every function name on it. */
function stackFrames(stack) {
  let innermost = null;
  const names = new Set();
  for (const line of stack.split("\n").slice(1)) {
    const mt = FRAME_RE.exec(line);
    if (!mt) continue;
    const name = mt[1].split(".").pop();
    names.add(name);
    if (innermost === null && mt[2].includes("/idiomatic/")) innermost = name;
  }
  return { innermost, names };
}

export class Reach {
  constructor(names, layer) {
    this.layer = layer;
    this.frame = 0; // the painted-frame index code is running for; the frame loop advances it
    this.routines = {};
    for (const name of names) {
      const addr = NAME_TO_ADDR.get(name);
      if (addr === undefined) throw new Error(`--reach: ${name} is not a routine in idiomatic/names.js`);
      this.routines[name] = { addr, via: [], hits: new Map() };
    }
  }

  hit(name) {
    const h = this.routines[name].hits;
    h.set(this.frame, (h.get(this.frame) || 0) + 1);
  }

  /** Idiomatic: count at each declared routine's body, in the tree idiomaticTree() built for it. */
  async attachTree(tree) {
    const { entryHook } = await import(tree.hook.href);
    entryHook.hit = (name) => this.hit(name);
    for (const r of Object.values(this.routines)) r.via.push("body-entry");
  }

  /** Oracle: wrap each declared routine's entry in the routine map (address -> fn). */
  wrapMap(map) {
    for (const [name, r] of Object.entries(this.routines)) {
      const fn = map.get(r.addr);
      if (!fn) continue;
      const self = this;
      const wrapped = fn instanceof GeneratorFunction
        ? function* (m, ...a) { self.hit(name); return yield* fn(m, ...a); }
        : (m, ...a) => { self.hit(name); return fn(m, ...a); };
      map.set(r.addr, wrapped);
      r.via.push("routine-map-dispatch");
    }
  }

  /** Stack-attributed probes for the inlined arms (idiomatic layer only). */
  installProbes(machine) {
    if (this.layer !== "idiomatic") return;
    const probes = Object.entries(DIRECT_PROBES).filter(([name]) => name in this.routines);
    if (!probes.length) return;
    for (const [name] of probes) this.routines[name].via.push("host-stack");
    const mem = machine.mem;
    const real = mem.read8.bind(mem);
    mem.read8 = (addr) => {
      const v = real(addr);
      const a = addr & 0xffff;
      let frames = null;
      for (const [name, p] of probes) {
        if (!p.cell(machine, a)) continue;
        if (frames === null) {
          const lim = Error.stackTraceLimit;
          Error.stackTraceLimit = 200;
          frames = stackFrames(new Error().stack);
          Error.stackTraceLimit = lim;
        }
        if (frames.innermost !== p.fn) continue;
        if (p.under && !p.under.some((u) => frames.names.has(u))) continue;
        this.hit(name);
      }
      return v;
    };
  }

  /** Hits of `name` at painted-frame index >= from. */
  hitsFrom(name, from) {
    let n = 0;
    for (const [f, c] of this.routines[name].hits) if (f >= from) n += c;
    return n;
  }

  toJSON() {
    const out = {};
    for (const [name, r] of Object.entries(this.routines)) {
      out[name] = {
        addr: `0x${r.addr.toString(16).padStart(4, "0")}`,
        via: r.via,
        hits: [...r.hits].sort((x, y) => x[0] - y[0]),
      };
    }
    return { layer: this.layer, routines: out };
  }
}
