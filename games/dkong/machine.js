// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Donkey Kong machine: address space + I/O + register file, plus the
 * frame accounting both validation modes are indexed by. Rationale, measurements
 * and history for everything below: docs/boards/dkong.md.
 *
 * FRAME SAMPLING CONTRACT (do not drift): state[N] is sampled at the frame
 * boundary BEFORE frame N's CPU execution (state[0] = power-on), matching MAME's
 * frame notifier. Sampling after execution puts every frame off by one.
 */

import { AddressSpace } from "../../boards/dkong/memory.js";
import { IO, Inputs, NotImplemented } from "../../boards/dkong/io.js";
import { Regs } from "../../core/cpu/z80.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { loc_0000 as romReset } from "./translated/loc_0000.js";
import { bootOnly } from "./translated/bootOnly.js";
import { loc_0066 } from "./translated/loc_0066.js";
import { ORACLE_ROUTINES, buildRoutines } from "./routines.js";
import {
  buildPalette, CYCLES_PER_LINE, decodeSprites, decodeTiles, drawSprites,
  renderFrameRGB, renderRowRGB,
  SCREEN_H, splitProms, VBLANK_LINES,
} from "../../boards/dkong/video.js";

// Z80 T-states per frame, DERIVED: 3072000 / (6144000 / (384 * 264)) = 50688 exactly.
export const CYCLES_PER_FRAME = 50688;

// Vblank NMI asserts AT the frame boundary (measured via 0x0066 fetch taps). MAME's
// frame origin is the vblank point; 46080 (VBSTART/VTOTAL) was the wrong origin.
export const NMI_CYCLE_IN_FRAME = 0;

/** Thrown to unwind translated code once enough frames are captured; runFrames() catches it. */
export class FramesComplete extends Error {
  constructor() {
    super("requested frame count captured");
    this.name = "FramesComplete";
  }
}

/**
 * Oracle routines whose `false` return is a Z80 CALLER-SKIP (`inc sp x2 / ret` or
 * `pop hl / ret`): the seam owes TWO brackets on that path. Membership is re-derived
 * from the frozen oracle by idiomatic/test/idiomatic.test.js. Listing a one-word
 * `false` (0x2B53/0x2B9B/0x2BE1/0x06B8/0x2880) would over-pop; 0x3E99's +4 is a
 * consumed argument, not a skip. Per-entry evidence: docs/boards/dkong.md.
 */
const SEAM_CALLER_SKIP = new Set([
  0x1e8c, // runHitEffectInsteadOfPlay     pop hl / ret      (MEASURED false:+4)
  0x30fa, // loc_30fa                      pop hl / ret      (MEASURED false:+4)
  0x33a1, // loc_33a1                      inc sp x2 / ret   (ROM bytes `33 33 c9`; attract never takes it)
  0x0008, // loc_0008 gameActiveGuard      inc sp x2 / ret   (measured false:+4)
  0x0010, // loc_0010 marioActiveGuard     inc sp x2 / ret   (measured false:+4)
  0x0018, // loc_0018 tickSubstateTimer    inc sp x2 / ret   (measured false:+4)
  0x0020, // loc_0020 tickSubstatePrescaler pop hl / ret     (measured false:+4)
  0x0030, // loc_0030 boardBitGate         pop hl / ret      (measured false:+4)
  0x1783, // loc_1783 allSlotsClear        jp 0x0026 -> pop hl / ret
  0x1a2a, // loc_1a2a advanceSubstateWhenGrounded  pop hl + tail 0x19d2 whose ret pops
  0x1e85, // loc_1e85 enterBoardAdvanceAndUnwind   pop hl / ret
  0x2257, // loc_2257                      pop hl / ret
  0x236e, // findOppositeLadderEnd         pop hl / ret
  0x2913, // loc_2913 findCollidingObject  pop ix / inc sp x2 / ret
  0x2b29, // loc_2b29                      tails into 0x2b51 (measured false:+4)
  0x2b51, // loc_2b51                      pop hl / ret      (measured false:+4)
  0x2b74, // loc_2b74                      pop hl / ret
  0x2b91, // loc_2b91                      pop hl / ret
  0x3110, // loc_3110                      inc sp x2 / ret   (measured false:+4)
  0x311b, // loc_311b                      inc sp x2 / ret
  0x3126, // loc_3126                      inc sp x2 / ret
  0x3131, // loc_3131                      inc sp x2 / ret
  0x313c, // spawnRequestedFireAndRecolorLiveFires  inc sp x2 / ret   (measured false:+4)
]);

// `jp`-tail targets whose oracle never `ret`s (the board-layout walk loops back to
// 0x0DA7, net-zero stack): the seam must consume nothing, or the NMI epilogue rets off 0x6c00.
const SEAM_TAIL_NO_RET = new Set([
  0x0dd3, // loc_0dd3            jp 0x0da7 -- back to the walk head
  0x0e19, // drawLadder          jp 0x0da7
  0x0e2a, // drawSegmentEndCap   jp 0x0da7
  0x0e4f, // drawGirderSpan      jp 0x0da7
]);

/** Exported so idiomatic/test/idiomatic.test.js can re-derive both tables from the frozen oracle. */
export { SEAM_CALLER_SKIP, SEAM_TAIL_NO_RET };

/**
 * THE TRANSLATED->IDIOMATIC SEAM: close the Z80 call bracket a frozen translated
 * caller opened (`push16(RET); step; call(T)`) for an idiomatic callee that returns
 * without popping — unclosed, it leaks 2 bytes of guest stack per transition.
 * `opened` is read from EMISSION SHAPE (a push immediately before the dispatch), not
 * inferred from SP. Holds only while nothing interleaves push16 and call: a
 * scheduler-driven run with overrides must re-derive the bracket. Installed only
 * when an override exists. Full argument: docs/boards/dkong.md.
 *
 * @param {Machine} m
 * @returns {{lastPushSp:number, frames:Array}} the seam's bookkeeping
 */
function installCallBracketSeam(m) {
  const seam = {
    lastPushSp: -1, // guest SP straight after the most recent push16; -1 once invalidated
    frames: [], // one record per Machine.call dispatch: { spEntry, opened, taken }
  };

  const basePush = m.push16.bind(m);
  const basePop = m.pop16.bind(m);
  const baseCall = m.call.bind(m);

  m.push16 = (value) => {
    basePush(value);
    seam.lastPushSp = m.regs.sp;
  };
  m.pop16 = () => {
    seam.lastPushSp = -1; // any pop breaks push/dispatch adjacency
    return basePop();
  };
  m.call = (addr, ...args) => {
    // `opened` must be decided HERE, while push/dispatch adjacency is still observable.
    seam.frames.push({ spEntry: m.regs.sp, opened: seam.lastPushSp === m.regs.sp, taken: false });
    try {
      return baseCall(addr, ...args);
    } finally {
      seam.frames.pop();
    }
  };

  return seam;
}

/**
 * Consume ONE open call bracket at the CURRENT SP, walking OUT through the live
 * dispatch frames (a tail chain shares one SP); false = nothing to pop, a real answer.
 */
function consumeBracketAtSp(m, seam) {
  const sp = m.regs.sp;
  for (let i = seam.frames.length - 1; i >= 0; i--) {
    const f = seam.frames[i];
    if (f.spEntry < sp) continue; // a deeper frame we have already unwound past
    if (f.spEntry > sp) return false; // out past the matching level: nothing to consume
    if (!f.opened) continue; // a `jp` tail in the same chain — its bracket is further out
    f.opened = false;
    m.ret(0); // cycle-free: the idiomatic layer does not model T-states
    return true;
  }
  return false;
}

/** Wrap ONE resolved override so it closes the call bracket its translated caller opened. */
function seamWrap(addr, fn, seam) {
  // A generator is the engine-driven spine (boot/mainLoop): no translated caller, no bracket.
  if (fn.constructor && fn.constructor.name === "GeneratorFunction") return fn;
  const skips = SEAM_CALLER_SKIP.has(addr);
  const tailRets = !SEAM_TAIL_NO_RET.has(addr);
  return function seamed(mm, ...args) {
    const spEntry = mm.regs.sp;
    const top = seam.frames[seam.frames.length - 1];
    const own = top !== undefined && !top.taken && top.spEntry === spEntry ? top : undefined;
    if (own !== undefined) own.taken = true; // this dispatch frame is now accounted for

    const r = fn(mm, ...args);

    // SP moved = the body already ran an oracle `ret` (a delegating hook): touch nothing.
    if (mm.regs.sp !== spEntry) return r;

    if (own === undefined) {
      // Dispatched by a computed-`jp` dispatcher (m.overrides.get(t)(m)): bracket open by construction.
      mm.ret(0);
    } else if (own.opened) {
      own.opened = false;
      mm.ret(0); // the `ret` the idiomatic body replaced with a JS `return`
    } else if (!tailRets || !consumeBracketAtSp(mm, seam)) {
      // A `jp` tail the oracle would not have consumed a word for: no pop, no skip.
      return r;
    }
    if (r === false && skips) consumeBracketAtSp(mm, seam);
    return r;
  };
}

/**
 * Build the per-routine OVERRIDE MAP (target address -> handler) from already-resolved
 * functions; the declarative `{ module, export }` form must go through resolveOverrides()
 * first and throws here. Each override is seamWrap'd ONCE, so the same function lands in
 * this.overrides and this.routines. An empty spec installs no seam: the pure-oracle path
 * is unchanged by construction.
 *
 * @param {object|Map} [spec]
 * @param {Machine} [machine] the Machine these overrides are being built for
 * @returns {Map<number, function>}
 */
function buildOverrides(spec, machine) {
  const map = new Map();
  if (!spec) return map;
  const entries = spec instanceof Map ? [...spec.entries()] : Object.entries(spec);
  let seam = null;
  for (const [key, val] of entries) {
    const addr = typeof key === "number" ? key : parseInt(key, 16);
    if (typeof val === "function") {
      // already resolved (a test, or resolveOverrides' output)
      if (machine === undefined) {
        map.set(addr, val); // no Machine to hang the seam on (a bare spec normalisation)
      } else {
        if (seam === null) seam = installCallBracketSeam(machine);
        map.set(addr, seamWrap(addr, val, seam));
      }
    } else if (val && typeof val === "object" && "module" in val) {
      throw new Error(
        `override for 0x${addr.toString(16).padStart(4, "0")} is the declarative ` +
          "{ module, export } form; resolve it with resolveOverrides() first and pass " +
          "the result as opts.overrides. The Machine constructor cannot dynamic-import " +
          "synchronously.",
      );
    } else {
      throw new Error(
        `override for key ${key} must be a function or { module, export }, got ${typeof val}`,
      );
    }
  }
  return map;
}

/**
 * Resolve a declarative `manifest.optimized` block to a Map<number, function> by
 * dynamic import (Node and browser worker alike), paths relative to `baseUrl`.
 *
 * @param {object} [spec]     manifest.optimized: { "0xADDR": { module, export } }
 * @param {string|URL} [baseUrl]
 * @returns {Promise<Map<number, function>>}
 */
export async function resolveOverrides(spec = {}, baseUrl = import.meta.url) {
  const map = new Map();
  for (const [key, ent] of Object.entries(spec)) {
    const addr = parseInt(key, 16);
    const url = new URL(ent.module, baseUrl).href;
    const mod = await import(url);
    const fn = mod[ent.export];
    if (typeof fn !== "function") {
      throw new Error(
        `override ${key}: module ${ent.module} has no function export "${ent.export}"`,
      );
    }
    map.set(addr, fn);
  }
  return map;
}

export class Machine {
  /**
   * @param {Uint8Array} rom     16KB maincpu image
   * @param {object} [opts]
   * @param {Inputs} [opts.inputs]
   * @param {Uint8Array} [opts.gfx1]  tile ROMs -- enables frame rendering
   * @param {Uint8Array} [opts.proms] colour PROMs -- enables frame rendering
   */
  constructor(rom, opts = {}) {
    const { inputs, gfx1, proms, gfx2, overrides } = opts;
    this.rom = rom; // rom + assets retained for clone()
    this.assets = opts;
    this.io = new IO({ inputs: inputs ?? new Inputs() });
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.mem.clock = () => this.cycles;

    // mem8[ADDR] / mem16[ADDR] sugar for the idiomatic layer; rebuilt per instance (clone).
    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    this.frame = 0;
    this.booted = false;

    this.overrides = buildOverrides(overrides, this); // empty, hence inert, without opts.overrides

    // Oracle registry with overrides laid over it. A FRESH Map: the passed-in registry
    // (also in this.assets) must stay unmutated for clone() to rebuild from.
    const routines = opts.routines instanceof Map ? opts.routines : ORACLE_ROUTINES;
    this.routines = new Map(routines);
    for (const [addr, fn] of this.overrides) this.routines.set(addr, fn);

    this.cycles = 0;
    this.frames = []; // captured state dumps, one per frame boundary
    this.videoFrames = []; // completed RGB frames, one per frame, opt-in
    this.captureVideo = false; // off by default: 172032 bytes per frame
    this.rasterBuf = null; // frame being painted, row by row
    this.rasterRow = 0; // next scanline to paint, 0..SCREEN_H
    this.nextRowCycle = 0; // absolute cycle the next scanline starts at
    this.droppedFrames = 0; // frames abandoned mid-paint; only the last may be
    this.nextBoundary = Infinity; // set by runFrames()
    this.maxFrames = Infinity;
    this.maxCycles = Infinity;

    // Next vblank (absolute cycles); advances every frame even while the NMI is masked.
    this.nextNmi = NMI_CYCLE_IN_FRAME;

    this.video = null;
    if (gfx1 && proms) {
      this.video = {
        tiles: decodeTiles(gfx1),
        charColour: splitProms(proms).charColour,
        palette: buildPalette(proms),
        sprites: gfx2 ? decodeSprites(gfx2) : null, // no gfx2 = tilemap only, no sprites
      };
    }

    // ROM address of the NEXT instruction (what an accepted NMI pushes); set by step().
    this.pc = 0x0000;
    this.pcKnown = false;
    this.nmiCount = 0;
    this.stoppedBy = null; // why a bounded run ended, if not the budget

    // Poke tape [{addr,val,frame,dur}] from emit.js --poke (dur null = hold).
    this.pokes = null;

    // Input tape [{port,bits,frame,dur}] from emit.js --input: IN0/IN1/IN2 bits.
    this.inputTape = null;
  }

  /** Apply --poke entries due for `frameIndex`, at the boundary BEFORE sampling state[N]. */
  applyPokes(frameIndex) {
    if (!this.pokes) return;
    for (const p of this.pokes) {
      // dur frames from p.frame (null = indefinite hold)
      const due = frameIndex >= p.frame &&
        (p.dur == null || frameIndex < p.frame + p.dur);
      if (due) this.mem.write8(p.addr, p.val);
    }
  }

  /** Set io.inputAssert for all of `frameIndex`'s reads from the --input tape. */
  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      // dur frames from t.frame (null = indefinite); e.g. dur 6 = MAME's coin hold.
      const due = frameIndex >= t.frame &&
        (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  /**
   * Execute one translated instruction: `nextAddr` is the address of the NEXT
   * instruction (branch target if taken), `cycles` its T-states. The PC rides along
   * because an NMI pushes it into diffed work RAM; a stale PC must be unrepresentable.
   */
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.tick(cycles);
  }

  /**
   * Vector the vblank NMI as the Z80 does: push the current PC, jump to 0x0066.
   * The pushed PC lands in diffed work RAM, so an unknown PC throws rather than guesses.
   * No reentrancy guard: the handler clears the NMI mask (0x7d84) itself.
   */
  fireNmi() {
    if (!this.pcKnown) {
      throw new Error(
        `NMI accepted at cycle ${this.cycles} but the ROM PC is unknown: the ` +
          "routine executing here uses tick() rather than step(), so the " +
          "value pushed would be stale. The pushed PC lands in diffed work " +
          "RAM, so pushing a guess is worse than stopping. Convert that " +
          "routine to step().",
      );
    }
    this.nmiCount += 1;
    // NMI acceptance costs 11 T-states (measured: constant 11-cycle offset vs MAME at entry).
    this.push16(this.pc);
    this.cycles += 11;
    loc_0066(this);
  }

  /** Advance the T-state clock, sampling state[N] at each frame boundary crossed. */
  tick(n) {
    this.cycles += n;

    // ORDER IS LOAD-BEARING: drain rows, THEN sample, THEN NMI. Draining first is the
    // only guarantee row 223 is painted (a 3121-cycle DMA tick overshoots its 192-cycle
    // margin); sampling before the NMI keeps frame N's NMI out of state[N].
    this.drainRaster();

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      this.applyInputs(this.frames.length); // assert inputs for frame N
      this.applyPokes(this.frames.length); // poke frame N before sampling state[N]
      this.frames.push(this.dumpState());
      if (this.captureVideo) this.finishRasterFrame(); // publish the frame just painted
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    this.drainRaster();

    // Bounded by CYCLES, not frames: stopping at the boundary would skip that frame's NMI.
    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    // NMI only at an instruction boundary, as on the Z80 (source of the 10-21 cycle jitter).
    if (this.cycles >= this.nextNmi) {
      this.nextNmi += CYCLES_PER_FRAME;
      if (this.io.nmiMask) this.fireNmi();
    }

    // Invalidate AFTER the NMI check, or fireNmi's stale-PC guard can never fire.
    this.pcKnown = false;
  }

  /** Run from reset, capturing `count` state frames (frame 0 = power-on). */
  runFrames(count) {
    this.applyPokes(0); // frame-0 pokes (pre-boot) before sampling state[0]
    this.frames = [this.dumpState()]; // state[0], power-on
    this.videoFrames = [];
    this.droppedFrames = 0;
    if (this.captureVideo) this.startRasterFrame(0);
    if (count <= 1) return this.frames; // nothing to execute

    this.maxFrames = count;
    // One frame of overrun so side effects just past the last boundary (the NMI) still run.
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextNmi = NMI_CYCLE_IN_FRAME;
    this.stoppedBy = null;
    try {
      this.reset();
    } catch (e) {
      if (e instanceof FramesComplete) {
        // Ran the full cycle budget -- the normal end of a bounded run.
      } else if (e instanceof NotImplemented) {
        // Translation ran out: keep the valid frames and record why.
        this.stoppedBy = e.message;
      } else {
        throw e;
      }
    } finally {
      // Disarm the limits, or every later tick throws.
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  /** Z80 reset at PC=0x0000. NEVER RETURNS except via FramesComplete / NotImplemented. */
  reset() {
    romReset(this);
    this.booted = true;
  }

  /** Reset through the end of boot only. See bootOnly() in ./translated/bootOnly.js. */
  runBoot() {
    bootOnly(this);
    this.booted = true;
  }

  /**
   * Async factory with the same shape as games/thepit's Machine.create, which the
   * shared tools (tools/swap_check.mjs) call.
   *
   * @param {Uint8Array} rom
   * @param {object} [opts]  forwarded to the constructor (gfx/proms/overrides optional)
   * @returns {Promise<Machine>}
   */
  static async create(rom, opts = {}) {
    const routines = await buildRoutines();
    return new Machine(rom, { ...opts, routines });
  }

  /**
   * The Z80 stack is real, diffed work RAM (from 0x6BFF down): calls must write their
   * return address, and popped bytes are NOT cleared.
   */
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

  // RET: the popped value IS the next PC, so it goes through step().
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  /**
   * Invoke the routine at `addr` through the swap registry (override, else oracle).
   * The CALL's push16/step stay at the call site; args and return value are forwarded.
   */
  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      throw new Error(
        `m.call: no routine registered at 0x${addr.toString(16).padStart(4, "0")}`,
      );
    }
    return fn(this, ...args);
  }

  // LDIR at an arbitrary site: block-copy (DE)<-(HL), BC down, until BC==0.
  // `self` is the ROM address of the LDIR itself (charged 21 T-states per
  // iteration that repeats), `nextAddr` the instruction after it (16 on exit).
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

  // The fixed-site LDIR at ROM 0x01CF.
  ldir(nextAddr) {
    return this.ldirAt(0x01cf, nextAddr);
  }

  /** Render the current frame to 256x224 RGB888. Requires gfx1 and proms. */
  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs gfx1 and proms");
    const rgb = renderFrameRGB(
      this.mem.videoRam,
      this.video.tiles,
      this.video.charColour,
      this.video.palette,
      { gfxBank: 0, paletteBank: this.io.paletteBank, flip: this.io.flipScreen },
    );
    // renderFrameRGB is tilemap-only: without this pass the game renders spriteless.
    // Must match finishRasterFrame's sprite pass exactly (same opts).
    if (this.video.sprites) {
      drawSprites(
        rgb, this.mem.spriteRam, this.video.sprites, this.video.palette,
        { flip: this.io.flipScreen, paletteBank: this.io.paletteBank, spriteBank: this.io.spriteBank },
      );
    }
    return rgb;
  }

  /**
   * Paint every scanline the beam has passed, each from video RAM as it stands now.
   * Granularity is the tick, not the scanline (end-of-tick flip/palette state).
   */
  drainRaster() {
    if (!this.captureVideo || this.rasterBuf === null) return;
    while (this.rasterRow < SCREEN_H && this.cycles >= this.nextRowCycle) {
      renderRowRGB(
        this.rasterBuf, this.rasterRow, this.mem.videoRam, this.video.tiles,
        this.video.charColour, this.video.palette,
        { gfxBank: 0, paletteBank: this.io.paletteBank, flip: this.io.flipScreen },
      );
      this.rasterRow++;
      this.nextRowCycle += CYCLES_PER_LINE;
    }
  }

  /** Begin frame `n`: first displayed row is VBLANK_LINES (40) past the vblank-point origin, not VBEND. */
  startRasterFrame(n) {
    if (!this.video) throw new Error("raster capture needs gfx1 and proms");
    this.rasterBuf = new Uint8Array(256 * SCREEN_H * 3);
    this.rasterRow = 0;
    this.nextRowCycle = n * CYCLES_PER_FRAME + VBLANK_LINES * CYCLES_PER_LINE;
  }

  /** Publish the frame just finished (dropped, not published half-black, if incomplete); start the next. */
  finishRasterFrame() {
    if (this.rasterBuf !== null && this.rasterRow === SCREEN_H) {
      // Sprite post-pass from OUR end-of-frame sprite RAM (no-op while it is zero).
      if (this.video.sprites) {
        drawSprites(
          this.rasterBuf, this.mem.spriteRam, this.video.sprites,
          this.video.palette,
          {
            flip: this.io.flipScreen,
            paletteBank: this.io.paletteBank,
            spriteBank: this.io.spriteBank,
          },
        );
      }
      this.videoFrames.push(this.rasterBuf);
    } else if (this.rasterBuf !== null) {
      // Tripwire: reachable only by a tick longer than a frame.
      this.droppedFrames += 1;
    }
    // frames.length is already N+1 here; passing it silently dropped every frame.
    this.startRasterFrame(this.frames.length - 1);
  }

  /** 5120-byte state dump: work + sprite + video, per the frame-sampling contract. */
  dumpState() {
    return this.mem.dumpState();
  }

  /** Map a dumpState() byte offset back to its RAM address (delegates to mem). */
  stateOffsetToAddr(off) {
    return this.mem.stateOffsetToAddr(off);
  }

  /**
   * A fresh Machine on this ROM + assets with this one's RAM, registers and IO state,
   * frame machinery neutralised (Infinity) so a lone routine cannot sample, NMI or throw.
   */
  clone() {
    const c = new Machine(this.rom, this.assets);
    c.mem.workRam.set(this.mem.workRam);
    c.mem.spriteRam.set(this.mem.spriteRam);
    c.mem.videoRam.set(this.mem.videoRam);
    c.mem.discardedWrites = this.mem.discardedWrites;

    c.regs.copyFrom(this.regs);
    c.io.loadStateFrom(this.io);

    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.frame = this.frame;
    c.nmiCount = this.nmiCount;
    c.booted = this.booted;

    c.nextBoundary = Infinity;
    c.nextNmi = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }
}

/**
 * Resolve every routine in idiomatic/names.js's ROUTINES to an override map (what
 * web/worker.js ships). Module = `<name>.js`; export = `entry ?? name`, because a pure
 * function registered at a ROM address gets the Machine as an argument and silently no-ops.
 */
export async function resolveAllIdiomatic(baseUrl = import.meta.url) {
  const { ROUTINES } = await import(new URL("idiomatic/names.js", baseUrl).href);
  const spec = {};
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    spec[Number(addr).toString(16)] = {
      module: `./idiomatic/${meta.name}.js`,
      export: meta.entry ?? meta.name,
    };
  }
  return resolveOverrides(spec, baseUrl);
}

export async function makeMachineFactory(rom, assets = {}) {
  const routines = await buildRoutines();
  return (overrides) => new Machine(rom, { ...assets, routines, overrides });
}
