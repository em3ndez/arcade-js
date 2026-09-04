// SPDX-License-Identifier: GPL-3.0-only
import { clearPlayfield } from "./clearPlayfield.js";

// loc_1988 — a ROM entry point whose whole job is to clear the play-field framebuffer.
//
// WHAT IT IS
//   A thin call target at ROM 0x1988 that clears the interior play-field region of video RAM by
//   delegating to clearPlayfield. It exists as its own address because other ROM code reaches the
//   play-field wipe through this entry (e.g. the attract teardown finishAttractCycle calls it), distinct
//   from the direct clearPlayfield callers.
//
// ROLE IN THE MACHINE
//   clearPlayfield starts at PLAYFIELD_VRAM_BASE (0x2402) and walks each 32-byte video column, writing
//   bytes up through column offset 0x1b and skipping the six-byte margin at the column edge, so the two
//   lowest and four highest bytes of every column survive — the bottom status strip and the top score
//   band are preserved while everything between is blanked. This is the "erase the arena, keep the HUD"
//   clear used between attract/round screens; the whole-screen wipe is a different routine (clearScreen).
//
// ROM 0x1988.  Grounding: [seen].
//
// LIVE-OUT: none consumed by callers — memory-only (the original tail `ret`s; the seam completes it).
export function loc_1988(m) {
  // Delegate the entire body to the shared play-field clear. loc_1988 adds no behavior of its own; it is
  // purely the named ROM address at which callers enter the margin-preserving framebuffer wipe.
  clearPlayfield(m);
}
