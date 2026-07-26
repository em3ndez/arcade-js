// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit machine: address space + I/O + register file, plus the per-frame
 * accounting the state diff is indexed by. Modelled on games/dkong/machine.js,
 * with two whole subsystems removed because The Pit's hardware lacks them:
 *
 *   - NO i8257 DMA. The Pit renders sprites straight from sprite RAM, so there is
 *     no DMA stall to charge and no sprite-DMA blit. (DK's drainRaster / raster
 *     capture / sprite post-pass are all gone with it.)
 *   - NO optimized-override layer. This runs ONLY the frozen translated oracle:
 *     no manifest.optimized, no buildOverrides/resolveOverrides, no per-routine
 *     swap map. The registry (routines.js) IS the whole dispatch table.
 *
 * FRAME SAMPLING CONTRACT (do not drift): state frames are sampled at the frame
 * boundary BEFORE that frame's CPU execution.
 *   state[0] = power-on state, before a single instruction runs
 *   state[N] = state after frames 0..N-1 have executed
 * This is what MAME's frame notifier provides, so both sides sample identically.
 */

import { AddressSpace, STATE_DUMP_SIZE } from "../../boards/thepit/memory.js";
import { Io, NotImplemented } from "../../boards/thepit/io.js";
import { UnmappedAccess } from "../../boards/thepit/memory.js";
import { Regs } from "../../core/cpu/z80.js";
import { buildRoutines } from "./routines.js";
import { decodePalette, renderFrame as boardRenderFrame } from "../../boards/thepit/video.js";

/**
 * Z80 T-states per video frame, from boards/thepit/hardware.json:
 *   frame rate = 6.144MHz / (384 * 264) = 60.606… Hz
 *   cycles     = 3.072MHz / 60.606… = 50688 exactly
 * Identical to DK — same pixel clock and CRT geometry.
 */
export const CYCLES_PER_FRAME = 50688;

/**
 * The vblank NMI asserts AT THE FRAME BOUNDARY (cycle N * 50688), gated by the
 * LS259 mainlatch bit 0 (io.nmiMask). Same origin convention as DK's machine:
 * MAME's frame origin for this hardware IS the vblank point, so the NMI lands at
 * offset 0 into the frame. (The 11-T acceptance cost is charged in fireNmi.)
 */
export const NMI_CYCLE_IN_FRAME = 0;

/**
 * Thrown to unwind out of the translated code once the requested cycle budget is
 * spent. Boot + main loop never return (the main loop spins on vblank forever), so
 * unwinding is the only way to suspend at an arbitrary cycle. Not an error --
 * runFrames() catches it.
 */
export class FramesComplete extends Error {
  constructor() {
    super("requested frame count captured");
    this.name = "FramesComplete";
  }
}

/**
 * Thrown by m.call when the target ROM address has no translated routine. This is
 * the BOOT-GAP signal: it names the next routine that must be translated for the
 * machine to run further. Carries the address (and the return address sitting on
 * the stack, a best-effort "called from" hint) so emit.js can report where.
 */
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

export class Machine {
  /**
   * @param {Uint8Array} rom          20KB maincpu image (0x0000-0x4FFF)
   * @param {object} opts
   * @param {Map<number,function>} opts.routines  the oracle registry (REQUIRED;
   *        built by buildRoutines(), which is async — use Machine.create()).
   * @param {Uint8Array} [opts.gfx]   gfx image  — enables renderFrame()
   * @param {Uint8Array} [opts.proms] colour PROM — enables renderFrame()
   */
  constructor(rom, opts = {}) {
    const { routines, gfx, proms } = opts;
    if (!(routines instanceof Map)) {
      throw new Error(
        "Machine needs an already-built routine registry (opts.routines is a Map). " +
          "The registry is built by an async dynamic import, which a constructor " +
          "cannot await — call `await Machine.create(rom, opts)` instead.",
      );
    }
    this.rom = rom;
    this.assets = opts;
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.mem.clock = () => this.cycles;

    // The whole dispatch table. m.call(addr) invokes routines.get(addr). No
    // override layer: this is the frozen translated oracle, unmodified.
    this.routines = routines;

    this.cycles = 0;
    this.frame = 0;
    this.booted = false;
    this.frames = []; // captured state dumps, one per frame boundary
    this.nextBoundary = Infinity; // set by runFrames()
    this.maxFrames = Infinity;
    this.maxCycles = Infinity;
    this.nextNmi = NMI_CYCLE_IN_FRAME; // next vblank, absolute cycles
    this.nmiCount = 0;
    this.stoppedBy = null; // why a bounded run ended, if not the cycle budget
    this.stopError = null; // the actual error (UnregisteredRoutine / UnmappedAccess / …)

    // ROM address of the NEXT instruction to execute — what the Z80 pushes when it
    // accepts an NMI. Maintained by step(); tick() invalidates it so fireNmi can
    // refuse to push a stale PC (which would land in diffed work RAM).
    this.pc = 0x0000;
    this.pcKnown = false;

    // Optional video decode, only if the tile/palette ROMs were supplied. The Pit
    // renders a whole frame at once (no per-scanline raster), so this is a lazy,
    // on-demand hook — nothing is captured during runFrames().
    this.video = gfx && proms ? { gfx, pal: decodePalette(proms) } : null;
  }

  /**
   * Async factory: build the routine registry (dynamic import of every translated
   * module) then construct. This is the normal entry point — the constructor is
   * synchronous and cannot build the registry itself.
   *
   * @param {Uint8Array} rom
   * @param {object} [opts]  forwarded to the constructor (gfx/proms optional)
   * @returns {Promise<Machine>}
   */
  static async create(rom, opts = {}) {
    const routines = await buildRoutines();
    return new Machine(rom, { ...opts, routines });
  }

  /**
   * Execute one translated instruction: `nextAddr` is the ROM address of the
   * instruction AFTER this one, `cycles` its T-state cost. The PC rides along so
   * that an NMI accepted here pushes the value the hardware would (see fireNmi).
   */
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.mem.pc = nextAddr; // improves unmapped-access diagnostics; no diffed effect
    this.tick(cycles);
  }

  /**
   * Vector the vblank NMI as the Z80 would: push the current PC and enter the
   * handler at 0x0066. The pushed PC lands on the stack inside diffed work RAM, so
   * it must be the real next-instruction address — hence the pcKnown guard.
   *
   * No reentrancy guard is needed: the handler's first act clears the NMI-enable
   * bit (ld a,0 / ld (0xb000),a → io.nmiMask false), so the hardware gate is the
   * guard. loc_019c sets it back at exit.
   */
  fireNmi() {
    if (!this.pcKnown) {
      throw new Error(
        `NMI accepted at cycle ${this.cycles} but the ROM PC is unknown: the routine ` +
          "executing here used tick() rather than step(), so the pushed value would be " +
          "stale — and it lands in diffed work RAM. Convert that routine to step().",
      );
    }
    this.nmiCount += 1;
    // The Z80 spends 11 T-states accepting an NMI (acknowledge M1 + PC push) before
    // the handler's first byte is fetched.
    this.push16(this.pc);
    this.cycles += 11;
    this.call(0x0066); // the NMI handler, via the same registry every call uses
  }

  /**
   * Advance the T-state clock, capturing a state dump at each frame boundary
   * crossed, then service the vblank NMI. Ordering matches DK exactly:
   *   1. capture state[N] BEFORE frame N's NMI effects (sampling is defined to
   *      precede execution), so the boundary loop runs first;
   *   2. stop on the cycle budget (not the frame count — the NMI lands just AFTER
   *      a boundary, so a run must execute a little past the last sampled frame);
   *   3. accept the NMI if unmasked;
   *   4. invalidate the PC (a bare tick has no recorded successor).
   */
  tick(n) {
    this.cycles += n;

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      this.frames.push(this.dumpState());
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    if (this.cycles >= this.nextNmi) {
      this.nextNmi += CYCLES_PER_FRAME;
      if (this.io.nmiMask) this.fireNmi();
    }

    this.pcKnown = false;
  }

  /**
   * Run from reset, capturing up to `count` state frames.
   * frame 0 = power-on, sampled before a single instruction runs.
   *
   * Keeps whatever frames it captured and records WHY it stopped (a boot gap, an
   * unmapped access, or a NotImplemented stub) rather than discarding the run —
   * that stop reason is the work-list signal the emitter reports.
   */
  runFrames(count) {
    this.frames = [this.dumpState()]; // state[0], power-on
    this.stoppedBy = null;
    this.stopError = null;
    if (count <= 1) return this.frames;

    this.maxFrames = count;
    // Run a little past the last sampled frame so the NMI landing just after the
    // final boundary is still executed. Frames beyond `count` are not captured.
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
        // Translation ran out / hit an unimplemented device. The frames already
        // captured are valid; record why we stopped so the caller can report it.
        this.stoppedBy = e.message;
        this.stopError = e;
      } else {
        throw e;
      }
    } finally {
      // Leave the Machine usable; without this the frame limit stays armed and
      // every later tick throws.
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  /**
   * Z80 reset: entry at PC=0x0000. loc_0000 is `jp 0x01a4` into the boot init,
   * which falls through into the main loop and NEVER returns; it exits only via
   * FramesComplete or a translation gap. The power-on register file (Regs
   * constructor: AF=0x0040, IX=IY=0xFFFF, SP=0, rest 0) already matches
   * hardware.json's z80Reset, so nothing is re-established here.
   */
  reset() {
    this.call(0x0000);
    this.booted = true;
  }

  /**
   * The Z80 stack is real memory and it is diffed: `ld sp,0x83ff` puts it at the
   * top of work RAM (0x8000-0x87FF), inside the state-diff region. So each
   * translated `call` pushes its literal return address and the callee's `ret`
   * pops it — otherwise our RAM differs from MAME's at addresses no routine names.
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

  /** RET: pop the return address and continue there. The popped value is the next
   *  PC, so it is what step() records — a `ret` cannot be a plain JS return. */
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  /**
   * Invoke the routine at ROM address `addr` through the registry — the frozen
   * translated oracle. Every inter-routine call is `m.call(0xADDR)`; the
   * push16/step that model the CALL's stack push and cycle cost stay at the call
   * site next to it. Extra args and the return value are forwarded (harmless: The
   * Pit's translation parameterises no routine, but this keeps the API identical
   * to DK's and to the rst skip-idiom).
   */
  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      // Best-effort "called from": the word on top of the stack is usually the
      // caller's return address. Reading RAM here is safe (sp is in work RAM).
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

  /**
   * LDIR at an arbitrary site: block-copy (DE)<-(HL), BC down, until BC==0. `self`
   * is the ROM address of the LDIR itself (21 T-states per repeating iteration),
   * `nextAddr` the instruction after it (16 T on exit). The Pit's one use is
   * loc_00a5 copying the 0x20-byte sprite record 0x8220 → sprite RAM 0x9840.
   */
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

  /**
   * Render the current frame to 256x224 RGB888. Optional, on demand — requires gfx
   * and proms at construction. The Pit composes a whole frame at once (five layers,
   * see boards/thepit/video.js), so there is no per-scanline capture during a run.
   */
  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs gfx and proms at construction");
    return boardRenderFrame(this.mem, this.video.gfx, this.video.pal, this.io);
  }
}

export { STATE_DUMP_SIZE };
