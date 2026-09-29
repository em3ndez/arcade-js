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
 *   - dispatched through the override map (idiomatic) or the routine map (oracle): the map entry is
 *     wrapped and every dispatch counts. Idiomatic wraps the RESOLVED idiomatic function before the
 *     machine is built, so an unwired routine (falling back to its translated twin) counts nothing.
 *   - called directly by another idiomatic module (no map dispatch exists to wrap): attributed by the
 *     host call stack on a probe read the routine's own body makes (DIRECT_PROBES). A body that no
 *     longer runs makes no probe read and counts nothing.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, resolveAllIdiomatic } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import { parseEmitArgs } from "../../../tools/emit-core.js";
import { ROUTINES } from "../idiomatic/names.js";

export const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/timeplt

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
 * routines. `idiomaticBase` (tests only) resolves the idiomatic layer from another tree -- the
 * mutant copies in test/distant-reach-tape.test.js; `editOverrides` (tests only) edits the resolved
 * override map before it is instrumented. Returns { machine, reach } (reach null when not asked).
 */
export async function createRenderMachine(args, { idiomaticBase, editOverrides } = {}) {
  const gfx = {
    tiles: loadRegion("tiles", args.tiles),
    sprites: loadRegion("sprites", args.sprites),
    proms: loadRegion("proms", args.proms),
  };
  const romImage = new Uint8Array(readFileSync(args.rom));
  const overrides = args.idiomatic ? await resolveAllIdiomatic(idiomaticBase) : null;
  if (overrides && editOverrides) editOverrides(overrides);

  const reach = args.reach?.length ? new Reach(args.reach, args.idiomatic ? "idiomatic" : "oracle") : null;
  let machine;
  if (args.idiomatic) {
    if (reach) reach.wrapMap(overrides);
    machine = await Machine.create(romImage, { ...gfx, overrides });
  } else {
    const routines = buildRoutines();
    if (reach) reach.wrapMap(routines);
    machine = new Machine(romImage, routines, gfx);
  }
  if (reach) reach.installProbes(machine);
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;
  return { machine, reach };
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
 * Routines the idiomatic layer calls DIRECTLY (an import, not a map dispatch), attributed by the
 * host call stack on a read their own body makes: `fn` must be the innermost idiomatic frame of the
 * read, and every `under` entry (if given) must be the name of SOME frame on the stack. `cell(m, a)`
 * pre-filters reads so a stack is captured only where the probe can fire.
 *
 * ★ stepCountdownSlotThenCloseTurn (0x4108) is INLINED into serviceSlotByMarkerThenCloseSweepTurn
 * (0x40ea): its ROM body is the sweep's drifting-countdown arm, reached as a call into
 * stepDriftingCountdownObjectByEraFrames from the sweep. That ARM is what is counted -- the 0x4108
 * map entry is also wrapped, so a direct dispatch of it counts too.
 */
export const DIRECT_PROBES = {
  serviceSlotByMarkerThenCloseSweepTurn: {
    cell: (m, a) => a === (m.regs.ix & 0xffff), // the slot's marker byte, read first thing
    fn: "serviceSlotByMarkerThenCloseSweepTurn",
  },
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

  /** Wrap each declared routine's entry in an address->fn map (overrides or the routine map). */
  wrapMap(map) {
    for (const [name, r] of Object.entries(this.routines)) {
      const fn = map.get(r.addr);
      if (!fn) continue;
      const self = this;
      const wrapped = fn instanceof GeneratorFunction
        ? function* (m, ...a) { self.hit(name); return yield* fn(m, ...a); }
        : (m, ...a) => { self.hit(name); return fn(m, ...a); };
      map.set(r.addr, wrapped);
      r.via.push(this.layer === "idiomatic" ? "override-dispatch" : "routine-map-dispatch");
    }
  }

  /** Stack-attributed probes for the directly-called routines (idiomatic layer only). */
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
