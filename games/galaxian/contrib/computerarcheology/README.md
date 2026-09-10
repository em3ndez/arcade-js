![Galaxian](galaxian.jpg)

>>> deploy:<br>
>>>   +galaxian.jpg<br>
>>>   Hardware.md<br>
>>>   RAMUse.md<br>
>>>   %Code.md<br>

# Galaxian

**Disassembled by Karl Stiefvater**

**Galaxian** (Namco, 1979) is a fixed-shooter. You pilot a **ship** that slides left and
right along the bottom of the screen and fires a single **shot** up at a **formation** of
aliens massed above you. You clear a wave by destroying every alien in it, then the next
wave forms and the game presses harder.

What made Galaxian new was that the aliens do not just sit and shuffle — they **break
formation and dive**. Individual aliens peel off the pack, swoop down in curving attack
runs while **dropping bombs**, and either loop back to their slot or crash past the bottom.
The prize targets are the **flagships** at the top of the formation: a flagship often
dives **escorted** by a pair of red aliens, and shooting the flagship while its escorts are
still alive scores a large bonus. Only one of your shots is in the air at a time, so aiming
matters — you must lead the diving aliens rather than spray.

You lose a life when an alien or a dropped bomb hits your ship. Lose all your ships and the
game ends. Points come from shooting aliens — worth more while diving than in formation —
and most of all from the escorted flagship bonus. The board colours and the attack tempo
step up as you advance, and a scrolling **star field** drifts behind the whole game.

## Navigation

  * [Hardware](Hardware.md) — CPU, memory map, I/O ports, the NMI-enable latch, sprite/tilemap/bullet layout, discrete sound
  * [Work RAM](RAMUse.md) — the named work-RAM cells (0x4000–0x43FF)
  * [Main CPU code](Code.md) — the annotated Z80 disassembly

## About this disassembly

This disassembly, RAM map, and game description were **produced by AI** and are
**verified against the original ROM and against MAME**. The recovered code was checked
to reproduce the ROM's own execution frame-for-frame, and the game model was confirmed
by observing the real game running under MAME. It is offered here transparently, as AI
work, precisely because it is machine-checked rather than hand-asserted — so verify it
against that evidence. Project: [https://github.com/qarl/arcade-js](https://github.com/qarl/arcade-js).

The disassembly covers the code reached from the machine's real entry points — the reset
vector (`0x0000`) and the vblank NMI (`0x0066`); ROM data tables (tile graphics indices,
lookup tables, the alien-attack and sprite layout data, text) are shown as `DEFB` data.
Galaxian is a single-CPU game: its sound is custom discrete-analogue hardware with no sound
processor, so there is no second-CPU disassembly to accompany this one.
