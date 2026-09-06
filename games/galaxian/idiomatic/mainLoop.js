// SPDX-License-Identifier: GPL-3.0-only
// The free-running main loop as a per-frame generator. Each frame it drains the ready display-list slots
// (control-byte bit7 clear) into their draw handlers, then runs the object-figure grid draw as the idle-work
// step, then yields -- the point at which the vblank NMI services the frame.
import { DISPLAY_LIST_CURSOR, loc_4000 } from "./names.js";
import { decodeDisplayListSlotAndDispatch } from "./decodeDisplayListSlotAndDispatch.js";
import { drawObjectFigureGridColumn } from "./drawObjectFigureGridColumn.js";

const RING_CELLS = 0x40; // the draw-command ring holds 32 two-byte slots; the drain cannot exceed it

export function* mainLoop(m) {
  const { mem8 } = m;
  for (;;) {
    let drained = 0;
    for (;;) {
      const cursor = mem8[DISPLAY_LIST_CURSOR];
      const cell = loc_4000 | cursor;
      const ctrl = mem8[cell];
      if (ctrl & 0x80) break; // bit7 set -> no ready slot; fall through to the idle-work step
      decodeDisplayListSlotAndDispatch(m, (ctrl << 1) & 0xff, cell);
      if (++drained > RING_CELLS) throw new Error("display-list drain exceeded the ring (malformed list)");
    }
    drawObjectFigureGridColumn(m); // idle-work step: draw one object-grid column this frame
    yield; // frame boundary -- the vblank NMI fires here
  }
}
