![Frogger](frogger.jpg)

>>> deploy:<br>
>>>   +frogger.jpg<br>
>>>   Hardware.md<br>
>>>   RAMUse.md<br>
>>>   %Code.md<br>

# Frogger

**Disassembled by Karl Stiefvater**

**Frogger** (Konami, 1981) is a road-and-river crossing game. You steer a **frog** one
hop at a time — up, down, left, or right — from the bottom of the screen to the row of
**five home bays** across the top, and you must fill **all five** to clear the board.

The screen is two hazard zones split by a safe median. The lower half is a **road** of
traffic lanes — cars, trucks, and dozers stream left and right, and touching any vehicle
kills the frog. The upper half is a **river**: the frog cannot swim, so open water
**drowns** it, and the only way across is to **ride** the logs and the backs of turtles
that drift by. Some turtle rows periodically **dive**, sinking any frog riding them, and
an **alligator** patrols among the logs.

The five bays at the top are the goal, but a bay may hold a hungry **alligator** (deadly)
or a **fly** (bonus) instead of being empty, and a **lady frog** rides the river to be
escorted home for extra points. A **countdown timer** limits each crossing — let it run
out and the frog is lost. Points come from each forward hop, reaching a bay, eating the
fly, escorting the lady frog, and the time remaining. Losing all your frogs ends the
game, with a chance to enter your initials on the high-score table. Fill all five bays
and the board rebuilds, faster and busier.

## Navigation

  * [Hardware](Hardware.md) — CPU, memory map, I/O ports, the NMI-enable latch, sprite/tilemap layout
  * [Work RAM](RAMUse.md) — the named work-RAM cells (0x8000–0x87FF)
  * [Main CPU code](Code.md) — the annotated Z80 disassembly

## About this disassembly

This disassembly, RAM map, and game description were **produced by AI** and are
**verified against the original ROM and against MAME**. The recovered code was checked
to reproduce the ROM's own execution frame-for-frame, and the game model was confirmed
by observing the real game running under MAME. It is offered here transparently, as AI
work, precisely because it is machine-checked rather than hand-asserted — so verify it
against that evidence. Project: [https://github.com/qarl/arcade-js](https://github.com/qarl/arcade-js).

The disassembly covers the code reached from the two entry points — the reset vector
(`0x0000`) and the vblank NMI (`0x0066`); ROM data tables (tilemaps, lookup tables, the
lane and sprite layout data, text) are shown as `DEFB` data.
