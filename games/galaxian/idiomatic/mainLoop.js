// SPDX-License-Identifier: GPL-3.0-only

/**
 * mainLoop — the free-running per-frame foreground loop, expressed as a generator.
 *
 * WHAT IT IS
 *   The CPU's foreground task in the born-live spine. Handlers across the game rarely draw or make sound
 *   inline; instead they append deferred work to the command-queue ring, and this loop is the drain that
 *   empties it whenever the CPU would otherwise be idle. Each iteration it drains every ready display-list
 *   slot into its draw handler, then does one step of idle background work (repainting a column of the
 *   object-figure grid), then yields — the yield being the point at which the vblank NMI services the frame.
 *
 * ROLE IN THE MACHINE
 *   Entered from enterMainLoop (ROM 0x2000), which clears the score/HUD scratch block and then hands off
 *   here. The queue is a 32-slot ring on page 0x40; a slot is ready when the high bit of its control byte
 *   is clear. The drain reads the cursor DISPLAY_LIST_CURSOR (0x40a1), forms the slot address on page 0x40
 *   (loc_4000 base), and while a slot is ready doubles its control byte ((ctrl<<1) below) and dispatches it
 *   through decodeDisplayListSlotAndDispatch, which indexes the even-keyed handler table from that already-
 *   doubled value and retires/advances the cursor.
 *   When the ring is empty it falls to drawObjectFigureGridColumn (the idle-work head), then yields.
 *
 * Grounding: [seen].
 */
import { DISPLAY_LIST_CURSOR, loc_4000 } from "./names.js";
import { decodeDisplayListSlotAndDispatch } from "./decodeDisplayListSlotAndDispatch.js";
import { drawObjectFigureGridColumn } from "./drawObjectFigureGridColumn.js";

const RING_CELLS = 0x40; // the draw-command ring holds 32 two-byte slots; the drain cannot exceed it

export function* mainLoop(m) {
  const { mem8 } = m;
  for (;;) {
    // Drain every ready slot in the command-queue ring this pass.
    let drained = 0;
    for (;;) {
      // Read the cursor and form the current slot's address on page 0x40; the control byte's bit7 says
      // whether a command is waiting.
      const cursor = mem8[DISPLAY_LIST_CURSOR];
      const cell = loc_4000 | cursor;
      const ctrl = mem8[cell];
      if (ctrl & 0x80) break; // bit7 set -> no ready slot; fall through to the idle-work step
      // Ready slot: dispatch it. The (ctrl << 1) doubling turns channel N into the even table index 2N.
      decodeDisplayListSlotAndDispatch(m, (ctrl << 1) & 0xff, cell);
      // Guard against a malformed list that never presents an empty slot.
      if (++drained > RING_CELLS) throw new Error("display-list drain exceeded the ring (malformed list)");
    }
    drawObjectFigureGridColumn(m); // idle-work step: draw one object-grid column this frame
    yield; // frame boundary -- the vblank NMI fires here
  }
}
