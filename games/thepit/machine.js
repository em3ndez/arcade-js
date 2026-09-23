// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit machine: address space + I/O + register file + the per-frame accounting the state diff is
 * indexed by. Modelled on dkong, with two subsystems dropped: NO i8257 DMA (sprites render straight
 * from sprite RAM — DK's drainRaster / raster capture / sprite post-pass gone); and an OVERRIDE
 * LAYER for the memory-equivalence gate (core/equivalence.js) — opts.overrides (already-resolved
 * Map<number,function>) layered over the oracle registry to wire an idiomatic routine live or hook a
 * target address, empty => byte-identical to translated.
 *
 * FRAME SAMPLING CONTRACT (do not drift; matches MAME's frame notifier so both sides sample alike):
 * frames sampled at the boundary BEFORE that frame's CPU execution. state[0] = power-on before a
 * single instruction runs; state[N] = after frames 0..N-1.
 */

import { AddressSpace, STATE_DUMP_SIZE } from "../../boards/thepit/memory.js";
import { Io, NotImplemented } from "../../boards/thepit/io.js";
import { UnmappedAccess } from "../../boards/thepit/memory.js";
import { Regs } from "../../core/cpu/z80.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { buildRoutines, ORACLE_ROUTINES } from "./routines.js";
import { decodePalette, renderFrame as boardRenderFrame } from "../../boards/thepit/video.js";

/** Z80 T-states per video frame (hardware.json; = DK, same clock/geometry): frame rate =
 *  6.144MHz/(384*264) = 60.606… Hz; cycles = 3.072MHz/60.606… = 50688 exactly. */
export const CYCLES_PER_FRAME = 50688;

/** The vblank NMI asserts AT THE FRAME BOUNDARY (cycle N*50688), gated by LS259 mainlatch bit 0
 *  (io.nmiMask). MAME's frame origin here IS the vblank point, so the NMI lands at offset 0 into the
 *  frame (as DK); the 11-T acceptance cost is charged in fireNmi. */
export const NMI_CYCLE_IN_FRAME = 0;

/** Thrown to unwind out of translated code once the cycle budget is spent. Boot + main loop never
 *  return (the loop spins on vblank forever), so unwinding is the only way to suspend at an arbitrary
 *  cycle. Not an error -- runFrames() catches it. */
export class FramesComplete extends Error {
  constructor() {
    super("requested frame count captured");
    this.name = "FramesComplete";
  }
}

/** Thrown by m.call when the target ROM address has no translated routine: the BOOT-GAP signal
 *  naming the next routine to translate. Carries the address + a best-effort "called from" hint (the
 *  return address on the stack) so emit.js can report where. */
export class UnregisteredRoutine extends Error {
  constructor(addr, retHint) {
    const a = `0x${addr.toString(16).padStart(4, "0")}`;
    const from = retHint === undefined
      ? ""
      : ` (return addr on stack ≈ 0x${retHint.toString(16).padStart(4, "0")})`;
    super(`no translated routine registered at ${a}${from}`);
    this.name = "UnregisteredRoutine";
    this.addr = addr;
    this.retHint = retHint;
  }
}

/** Build the per-routine OVERRIDE MAP (call target -> handler fn) from `spec` (object|Map): lets an
 *  idiomatic rewrite / capturing hook replace its translated counterpart WITHOUT editing any call site
 *  (m.call consults the layered registry). No spec => empty => exact translated behaviour. The Pit's
 *  overrides are ALREADY-RESOLVED functions; the declarative { module, export } form DK has needs an
 *  async import a constructor cannot await (no manifest.optimized yet), so it is rejected loudly. */
function buildOverrides(spec) {
  const map = new Map();
  if (!spec) return map;
  const entries = spec instanceof Map ? [...spec.entries()] : Object.entries(spec);
  for (const [key, val] of entries) {
    const addr = typeof key === "number" ? key : parseInt(key, 16);
    if (typeof val === "function") {
      map.set(addr, val);
    } else if (val && typeof val === "object" && "module" in val) {
      throw new Error(
        `override for 0x${addr.toString(16).padStart(4, "0")} is the declarative ` +
          "{ module, export } form, which The Pit has no resolver for yet. Pass an " +
          "already-resolved function as opts.overrides (the memory-equivalence gate " +
          "does); a constructor cannot dynamic-import synchronously.",
      );
    } else {
      throw new Error(
        `override for key ${key} must be a function, got ${typeof val}`,
      );
    }
  }
  return map;
}

export class Machine {
  /** rom = 20KB maincpu image (0x0000-0x4FFF). opts: routines (oracle registry, built by async
   *  buildRoutines()); overrides (already-resolved addr->fn layered over it, the equivalence-gate
   *  seam); gfx + proms (enable renderFrame()). */
  constructor(rom, opts = {}) {
    const { gfx, proms, overrides } = opts;
    // Registry is a static import, so build synchronously: reuse a caller-supplied Map (equivalence
    // factory shares one) or the static oracle table — lets the browser worker build directly, sync.
    const routines = opts.routines instanceof Map ? opts.routines : ORACLE_ROUTINES;
    this.rom = rom;
    this.assets = opts;
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.mem.clock = () => this.cycles;

    // Indexable views (mem8[ADDR]/mem16[ADDR] forward to this.mem read/write) — readability sugar,
    // rebuilt per instance so clone() gets views bound to its own memory. See core/mem-views.js.
    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    // Per-routine override map (call target -> handler). INERT unless opts.overrides supplies an
    // already-resolved map/object — the seam the equivalence harness drives. See buildOverrides.
    this.overrides = buildOverrides(overrides);

    // Dispatch table the swap layer resolves through: oracle registry + overrides. m.call(addr) uses
    // routines.get(addr), so an override replaces its oracle at EVERY call site; none => byte-identical
    // to translated. A FRESH Map so the passed-in registry (also in this.assets) is never mutated.
    this.routines = new Map(routines);
    for (const [addr, fn] of this.overrides) this.routines.set(addr, fn);

    this.cycles = 0;
    this.frame = 0;
    this.booted = false;
    this.frames = []; // captured state dumps, one per frame boundary
    // Live raster-render (opt-in, web worker): with captureVideo set, each frame boundary pushes the
    // RGB frame to videoFrames. Off by default — offline pipeline renders on demand from this.frames.
    this.captureVideo = false;
    this.videoFrames = [];

    this.nextBoundary = Infinity; // set by runFrames()
    this.maxFrames = Infinity;
    this.maxCycles = Infinity;
    this.nextNmi = NMI_CYCLE_IN_FRAME; // next vblank, absolute cycles
    this.nmiCount = 0;
    this.stoppedBy = null; // why a bounded run ended, if not the cycle budget (+ stopError below)
    this.stopError = null;

    // Input-tape testing (null normally). inputTape=[{port,bits,frame,dur}] asserted onto io each
    // frame; pokes=[{addr,val,frame,dur}] written at the boundary. Set by emit.js; mirror MAME's tape.
    this.inputTape = null;
    this.pokes = null;

    // ROM address of the NEXT instruction — what the Z80 pushes on NMI accept. Maintained by
    // step(); tick() invalidates it so fireNmi refuses to push a stale PC (lands in diffed work RAM).
    this.pc = 0x0000;
    this.pcKnown = false;

    // Optional video decode, only if the tile/palette ROMs were supplied. The Pit renders a whole
    // frame at once (no per-scanline raster) — a lazy, on-demand hook, nothing captured in runFrames.
    this.video = gfx && proms ? { gfx, pal: decodePalette(proms) } : null;

    // Coroutine warm-restart (runIdiomaticGame): main generator hands the engine a successor via
    // nextMain; RESTART is the sentinel restartMain() throws for a MID-FRAME restart (see below).
    // Per-instance so a clone's throw/catch pair share one identity.
    this.nextMain = null;
    this.RESTART = Symbol("restart-main");
  }

  /** Warm-restart from mid-frame. A round-boundary service (dispatchObjectFrameByStateTimer,
   *  tickObjectDwellThenTransition) runs DEEP in the gameplay call tree; on timer expiry the frozen
   *  oracle tail-jumps into a fresh never-returning main loop — a non-local exit. So it records the
   *  successor in nextMain and throws RESTART, which unwinds up through the plain call tree (nothing
   *  catches it) out of mainLoop's .next(); runIdiomaticGame catches it, swaps in the successor, and the
   *  abandoned frame is never resumed. `factory` builds the successor generator, e.g.
   *  () => advanceToNextLevel(m). No-op outside the coroutine engine (the throw would escape). */
  restartMain(factory) {
    this.nextMain = factory;
    throw this.RESTART;
  }

  /** Async factory: build the routine registry (dynamic import of every translated module) then
   *  construct. The normal entry point — the sync constructor cannot build the registry. opts (gfx/
   *  proms optional) is forwarded. */
  static async create(rom, opts = {}) {
    const routines = await buildRoutines();
    return new Machine(rom, { ...opts, routines });
  }

  /** Execute one translated instruction: `nextAddr` = ROM address of the instruction AFTER this,
   *  `cycles` its T-state cost. The PC rides along so an NMI accepted here pushes what the hardware
   *  would (see fireNmi). */
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.mem.pc = nextAddr; // improves unmapped-access diagnostics; no diffed effect
    this.tick(cycles);
  }

  /** Vector the vblank NMI as the Z80 would: push PC and enter the handler at 0x0066. The pushed PC
   *  lands in diffed work RAM, so it must be the real next-instruction address — hence the pcKnown
   *  guard. No reentrancy guard needed: the handler clears the NMI-enable bit (ld a,0 / ld (0xb000),a
   *  → io.nmiMask false), so hardware is the guard; loc_019c re-arms at exit. The idiomatic layer is
   *  SP-retired (its handler returns in plain JS, interrupt-return memory-inert), so it pushes no PC;
   *  only the cycle-accurate translated path rides the guest stack for its ret. */
  fireNmi() {
    if (!this.pcKnown) {
      throw new Error(
        `NMI accepted at cycle ${this.cycles} but the ROM PC is unknown: the routine ` +
          "executing here used tick() rather than step(), so the pushed value would be " +
          "stale — and it lands in diffed work RAM. Convert that routine to step().",
      );
    }
    this.nmiCount += 1;
    // 11 T-states to accept an NMI (acknowledge M1 + PC push) before the handler's first fetch.
    // Only the translated path pushes; the idiomatic layer is SP-retired.
    if (!this.idiomaticNmi) this.push16(this.pc);
    this.cycles += 11;
    this.call(0x0066);
  }

  /** Apply --poke entries due for `frameIndex`, at the frame boundary before exec. */
  applyPokes(frameIndex) {
    if (!this.pokes) return;
    for (const p of this.pokes) {
      // dur frames from p.frame (null = indefinite hold); a finite hold releases after N so the
      // game's own code manages the byte during play (e.g. a level-select poke).
      const due =
        frameIndex >= p.frame && (p.dur == null || frameIndex < p.frame + p.dur);
      if (due) this.mem.write8(p.addr, p.val);
    }
  }

  /** Assert --input tape entries for `frameIndex` onto io.inputAssert — a fresh {portAddr:
   *  pressedBits} map rebuilt every frame so a one-frame pulse (coin/start) releases and a held
   *  direction stays down. readIn0/readIn1 fold these in with polarity. Mirrors the MAME lua tape. */
  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      const due =
        frameIndex >= t.frame && (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  /** Advance the T-state clock, capturing a state dump at each frame boundary crossed, then service
   *  the vblank NMI. Order matches DK: (1) capture state[N] BEFORE frame N's NMI effects (sampling
   *  precedes execution); (2) stop on the cycle budget, not the frame count — the NMI lands just AFTER
   *  a boundary; (3) accept the NMI if unmasked; (4) invalidate the PC (a bare tick has no successor). */
  tick(n) {
    this.cycles += n;

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      // Frame N (= this.frames.length) is about to execute after state[N] is sampled: assert its
      // inputs and apply its pokes first, so both are in effect during frame N — MAME's timing.
      this.applyInputs(this.frames.length);
      this.applyPokes(this.frames.length);
      this.frames.push(this.dumpState());
      if (this.captureVideo) this.finishRasterFrame();
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    if (this.cycles >= this.nextNmi) {
      this.nextNmi += CYCLES_PER_FRAME;
      if (this.io.nmiMask) this.fireNmi();
    }

    this.pcKnown = false;
  }

  /** Run from reset, capturing up to `count` state frames (frame 0 = power-on, before any instruction).
   *  Keeps whatever it captured and records WHY it stopped (boot gap / unmapped access / NotImplemented
   *  stub) rather than discarding the run — that reason is the emitter's work-list signal. */
  runFrames(count) {
    this.io.inputAssert = null;
    this.applyInputs(0); // frame-0 inputs, symmetric with applyPokes(0) + MAME's f==0
    this.applyPokes(0); // frame-0 (pre-boot) pokes, before sampling state[0]
    this.frames = [this.dumpState()]; // state[0], power-on
    this.stoppedBy = null;
    this.stopError = null;
    if (count <= 1) return this.frames;

    this.maxFrames = count;
    // Run a little past the last sampled frame so the NMI just after the final boundary still
    // executes. Frames beyond `count` are not captured.
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextNmi = NMI_CYCLE_IN_FRAME;
    try {
      this.reset();
    } catch (e) {
      if (e instanceof FramesComplete) {
        // Ran the full cycle budget — the normal end of a bounded run.
      } else if (
        e instanceof UnregisteredRoutine ||
        e instanceof UnmappedAccess ||
        e instanceof NotImplemented
      ) {
        // Translation ran out / hit an unimplemented device. Captured frames are valid; record why.
        this.stoppedBy = e.message;
        this.stopError = e;
      } else {
        throw e;
      }
    } finally {
      // Leave the Machine usable; else the frame limit stays armed and every later tick throws.
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  /** Z80 reset: entry at PC=0x0000. loc_0000 is `jp 0x01a4` into boot init, which falls into the main
   *  loop and NEVER returns (exits only via FramesComplete or a translation gap). The power-on regfile
   *  (Regs ctor: AF=0x0040, IX=IY=0xFFFF, SP=0, rest 0) already matches hardware.json's z80Reset. */
  reset() {
    this.call(0x0000);
    this.booted = true;
  }

  /** The Z80 stack is real memory and IS diffed: `ld sp,0x83ff` seats it at the top of work RAM
   *  (0x8000-0x87FF). So each translated `call` pushes its return address and the callee's `ret` pops
   *  it — else our RAM diverges from MAME's. */
  push16(value) {
    const { regs, mem } = this;
    regs.sp = (regs.sp - 2) & 0xffff;
    mem.write8(regs.sp, value & 0xff);
    mem.write8((regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }

  pop16() {
    const { regs, mem } = this;
    const lo = mem.read8(regs.sp);
    const hi = mem.read8((regs.sp + 1) & 0xffff);
    regs.sp = (regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }

  /** RET: the popped value IS the next PC (what step() records), so a `ret` cannot be a JS return. */
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  /** Invoke the routine at ROM `addr` through the registry (the layered oracle). Every inter-routine
   *  call is `m.call(0xADDR)`; the push16/step modelling the CALL's stack push + cycle cost stay at the
   *  call site. Extra args + return value are forwarded (harmless: The Pit parameterises no routine,
   *  but keeps the API identical to DK's and the rst skip-idiom). */
  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      // Best-effort "called from": the top-of-stack word is usually the caller's return address.
      // Reading RAM here is safe (sp is in work RAM).
      let retHint;
      try {
        retHint = this.mem.read16(this.regs.sp);
      } catch {
        retHint = undefined;
      }
      throw new UnregisteredRoutine(addr, retHint);
    }
    return fn(this, ...args);
  }

  /** LDIR at an arbitrary site: block-copy (DE)<-(HL), BC down, until BC==0. `self` = ROM address of
   *  the LDIR (21 T-states per repeat), `nextAddr` the instruction after (16 T on exit). The Pit's one
   *  use is loc_00a5 copying the 0x20-byte sprite record 0x8220 → sprite RAM 0x9840. */
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }

  /** 4352-byte state dump: work + colour + video + attr/sprite, per the contract. */
  dumpState() {
    return this.mem.dumpState();
  }

  /** Map a dumpState() byte offset back to its RAM address (delegates to mem). */
  stateOffsetToAddr(off) {
    return this.mem.stateOffsetToAddr(off);
  }

  /** A fresh Machine on this ROM + assets, restored to this machine's observable state (board RAM,
   *  register file, IO value-state). Frame machinery is NEUTRALISED (boundaries/NMI/budget → Infinity)
   *  so running ONE routine in isolation cannot trip a frame sample, fire an NMI (whose handler would
   *  write RAM and masquerade as a side effect), or throw FramesComplete — the unit gate measures the
   *  routine, not the scheduler. Rebuilds from this.assets, so it carries the source's `overrides` incl.
   *  the gate's snapshot override; harmless, since the gate invokes the routine under test DIRECTLY and
   *  the override map is consulted only for an m.call back INTO itself, where the snapshot delegates to
   *  the oracle (whole-machine equivalence backstops an override recursing into itself). */
  clone() {
    const c = new Machine(this.rom, this.assets);

    // Board RAM — every diffed array, copied by value.
    c.mem.workRam.set(this.mem.workRam);
    c.mem.colorRam.set(this.mem.colorRam);
    c.mem.videoRam.set(this.mem.videoRam);
    c.mem.attrsprRam.set(this.mem.attrsprRam);
    c.mem.pc = this.mem.pc; // diagnostic only; no diffed effect

    // Register file — copies exactly REG_FIELDS (core/cpu/z80.js).
    c.regs.copyFrom(this.regs);

    // IO value-state. The Pit's Io has no loadStateFrom (boards/ frozen), so mutable fields are copied
    // by hand: raw port bytes, DSW, the LS259 control latch (holds nmiMask/flip), sound latch, watchdog.
    c.io.in0 = this.io.in0;
    c.io.in1 = this.io.in1;
    c.io.in2 = this.io.in2;
    c.io.dsw = this.io.dsw;
    c.io.latch = this.io.latch;
    c.io.soundLatch = this.io.soundLatch;
    // Carry any asserted tape press so a mid-tape clone reads the same inputs as its source.
    c.io.inputAssert = this.io.inputAssert;
    c.io.watchdog.framesSinceKick = this.io.watchdog.framesSinceKick;
    c.io.watchdog.enabled = this.io.watchdog.enabled;
    c.io.watchdog.timeoutFrames = this.io.watchdog.timeoutFrames;

    // Scheduler / bookkeeping.
    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.frame = this.frame;
    c.nmiCount = this.nmiCount;
    c.booted = this.booted;

    // Neutralise the frame machinery (see the method contract above).
    c.nextBoundary = Infinity;
    c.nextNmi = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }

  /** Render the current frame to 256x224 RGB888. On demand — requires gfx + proms at construction. The
   *  Pit composes a whole frame at once (five layers, boards/thepit/video.js), no per-scanline capture. */
  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs gfx and proms at construction");
    return boardRenderFrame(this.mem, this.video.gfx, this.video.pal, this.io);
  }

  /** Live-render hook at each frame boundary while captureVideo is set: push the composed RGB frame to
   *  videoFrames. Offline pipeline leaves captureVideo off. The web worker's LiveMachine overrides this
   *  to also blit to the shared framebuffer and pace to 60 Hz. */
  finishRasterFrame() {
    if (this.video) this.videoFrames.push(this.renderFrame());
  }
}

/** Resolve a game's declarative `manifest.optimized` block ({ "hhhh": {module, export} }) into a
 *  Map<addr,fn> the Machine layers over the oracle registry — the seam the web worker uses. Absent/
 *  empty => empty Map (pure translated run). The Pit ships no optimized routines yet, so this normally
 *  returns empty; it exists so the game-agnostic worker works for The Pit. */
export async function resolveOverrides(spec = {}, baseUrl = import.meta.url) {
  const map = new Map();
  for (const [key, ent] of Object.entries(spec)) {
    const addr = parseInt(key, 16);
    const url = new URL(ent.module, baseUrl).href;
    const mod = await import(url);
    const fn = mod[ent.export];
    if (typeof fn !== "function") {
      throw new Error(`override ${key}: module ${ent.module} has no function export "${ent.export}"`);
    }
    map.set(addr, fn);
  }
  return map;
}

/** Resolve the WHOLE idiomatic layer to an override Map<addr,fn> — every routine in ROUTINES wired to
 *  its `idiomatic/<name>.js`. The override set the frame-stepped engine (core/frame-stepped.js
 *  runWatchdogGame) runs live: with it wired, machine.reset() enters idiomatic boot at 0x0000 and the
 *  game runs entirely in the readable JS layer. Every routine has an idiomatic file; a missing one
 *  throws at import (loud). Used by the browser worker for the idiomatic runtime. */
export async function resolveAllIdiomatic(baseUrl = import.meta.url) {
  const { ROUTINES } = await import(new URL("idiomatic/names.js", baseUrl).href);
  const spec = {};
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    spec[Number(addr).toString(16)] = { module: `./idiomatic/${meta.name}.js`, export: meta.name };
  }
  return resolveOverrides(spec, baseUrl);
}

/** Build a SYNCHRONOUS makeMachine(overrides) factory for the memory-equivalence engine
 *  (core/equivalence.js), which calls it many times per gate. The Pit's registry is built by async
 *  buildRoutines a sync factory cannot await, so it is built ONCE here and closed over; each call is
 *  then a plain sync Machine construction with the given overrides. `assets` (gfx/proms etc) is
 *  forwarded to every Machine. The Pit's analogue of DK's inline `new Machine(ROM, { overrides })`. */
export async function makeMachineFactory(rom, assets = {}) {
  const routines = await buildRoutines();
  return (overrides) => new Machine(rom, { ...assets, routines, overrides });
}

export { STATE_DUMP_SIZE };
