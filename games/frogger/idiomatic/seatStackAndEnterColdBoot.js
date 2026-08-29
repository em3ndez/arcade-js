// SPDX-License-Identifier: GPL-3.0-only
/**
 * seatStackAndEnterColdBoot  —  ROM 0x0000  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The Z80 RESET vector — the very first code the CPU runs after a power-on or a watchdog reset. It sits
 *   at address 0x0000, where the processor's reset lands, and does three tiny things before handing the
 *   board over to the real boot code: it runs a (dead) self-check arm, kicks the watchdog so the board is
 *   not reset out from under the boot, and tail-jumps into the cold-boot init.
 *
 * WHERE IT SITS
 *   The entry point of the entire machine: hardware reset jumps straight here, and nothing calls it. It
 *   runs exactly once per power-on and then never again — control passes through the tail into
 *   initColdBootAndEnterMainLoop (ROM 0x02a3), which wipes RAM, programs the hardware, and enters the
 *   foreground main loop; from then on the machine lives inside that loop and its vblank NMI.
 *
 *   The name records the ROM instruction `ld sp,0x8800`, which seats the Z80 stack pointer as the third
 *   act of the vector. The generator idiomatic layer deliberately does NOT seat a stack: it dispatches
 *   routines with ordinary JS calls, not the Z80 hardware stack, and the engine's vblank-NMI push16 is
 *   never popped — so that instruction has no JS analogue and is simply dropped. (The name is thus a mild
 *   misnomer for what the JS does; kept as-is because renaming an exported routine is out of scope here.)
 *
 * LIVE-OUT
 *   Memory only, and entirely via the tail. This routine writes no RAM of its own; every cell that ends up
 *   changed is written by the cold-boot init it hands to. It returns whatever that tail returns — the
 *   foreground main-loop generator the engine drives — passing the iterator handoff straight through.
 */
import { WATCHDOG_RESET_PORT, SELF_CHECK_SOURCE } from "./names.js";
import { initColdBootAndEnterMainLoop } from "./initColdBootAndEnterMainLoop.js";

export function seatStackAndEnterColdBoot(m) {
  const { mem8 } = m;

  // ── The dead self-check arm ──────────────────────────────────────────────────────────
  // The ROM opens with `ld a,(0x4000); cp 0x55; jp z,0x4001` — read the self-check source, and if it holds
  // the magic byte 0x55, jump to 0x4001. SELF_CHECK_SOURCE (0x4000) is UNMAPPED on this board: the address
  // decodes to nothing, so the bus floats high and the read always returns 0xFF, never 0x55. The branch is
  // therefore never taken — and its target 0x4001 isn't even code — so this is a vestigial, permanently
  // dead self-test. We model it as an assertion of that memory-map invariant: if the source ever read 0x55
  // the dead arm would "fire", which could only mean the map is wrong, so we throw rather than follow it.
  if (mem8[SELF_CHECK_SOURCE] === 0x55) {
    throw new Error("seatStackAndEnterColdBoot: self-check jump armed -- self-check source read 0x55 (must float 0xFF)");
  }

  // ── Kick the watchdog ────────────────────────────────────────────────────────────────
  // The ROM's next act is `ld a,(0x8800)` — a bare read of WATCHDOG_RESET_PORT (0x8800), the board's
  // watchdog reset_r port. The value read is discarded; the READ ITSELF is the point — touching the port
  // pets the watchdog so it won't time out and reset the board while cold-boot init runs its long RAM wipe.
  // (The instruction that follows in the ROM, `ld sp,0x8800`, seats the Z80 stack at this same address;
  // the generator layer omits it, as noted in the header.)
  mem8[WATCHDOG_RESET_PORT];

  // ── Enter cold-boot init ─────────────────────────────────────────────────────────────
  // The vector ends with `jp 0x02a3` — a tail-jump into the cold-boot init. It pushes no return address
  // (the reset vector has no caller to return to), so this is a pure tail-call: run cold boot, and hand
  // back whatever it returns. initColdBootAndEnterMainLoop brings the whole board up and ultimately returns
  // the foreground main-loop generator, which we pass straight through to the engine.
  return initColdBootAndEnterMainLoop(m);
}
