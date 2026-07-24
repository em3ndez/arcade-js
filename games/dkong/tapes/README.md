# games/dkong/tapes/ — validation input tapes

These are **MAME Lua input scripts**: run under `mame dkong -autoboot_script <tape>.lua`, each
registers a per-frame notifier that presses inputs (`IN2` Coin/Start, `IN0` P1 directions/jump)
and/or pokes RAM, so MAME reaches a specific state deterministically. They are the fixtures the
pixel/state gate compares our JavaScript translation against (the emitter mirrors each tape's
inputs/pokes on the JS side).

Convention across tapes (the "pinned contract"): **coin at frame ~400, start at ~460**; frame
numbering is 1-based, end-of-frame (the JS emitter uses N+1 vs the MAME notifier's N).

| tape | board | exercises |
|---|---|---|
| `coin_start` | 25m | the foundational path: attract → credit → game-init → a barrel → **death** → game-over → high-score (dies on purpose — dying reaches more code) |
| `early_start` | 25m | same, but coins/starts as early as the ROM accepts (first sprite ~frame 80 instead of ~500) |
| `move_slope` | 25m | poke Mario onto a mid-board slope, hold Right — validates the `0x2AB4` slope-collision translation |
| `test_b1_walk_right` / `_walk_left` / `_climb_up` / `_jump` | 25m | single-input movement from a poked position |
| `test_b3_walk_right` | 75m | walk (pokes the board-3 pre-set to load 75m) |
| `test_b4_walk_right` | 100m | walk (pokes the board-4 pre-set to load 100m) |
| `test_hammer_25m_lower` / `_upper` | 25m | poke Mario beside a hammer, jump to grab — verify the hammer-active latch (`0x6217`) |
| `test_hammer_50m` / `_50m_upper` | 50m | hammer grab on the conveyor board |
| `level3_full` | 75m | coin+start + board-3 pre-set (for capturing a 75m golden) |
| `level4_full` | 100m | coin+start + board-4 pre-set (for capturing a 100m golden) |
| `test_prize_50m_hat` / `_50m_parasol` / `_50m_purse` | 50m | poke Mario onto a dropped prize (hat/parasol/purse) — pickup gate for `games/dkong/tools/prize_suite.py`: prize slot `0x6A0C` clears, BCD score `0x60B2` grows |
| `test_prize_75m_hat` / `_75m_parasol` / `_75m_purse` | 75m | same, board-3 pre-set |
| `test_prize_100m_hat` / `_100m_parasol` / `_100m_purse` | 100m | same, board-4 pre-set |
| `test_advance_25m_ladder` | 25m | **BOARD COMPLETION**: poke only Mario's *starting spot* on the girder below Pauline, walk him to the final ladder, climb it — the rescue fires (`0x600A`→`0x16`) and the board advances (`0x6227`: 1→4, i.e. 25m→100m) |

Higher boards are reached by **poking the board-type state** rather than by playing up to them —
see the porting docs. The board-2 (50m) full recipe and various climb experiments were working
scratch tapes and are intentionally not published here.

## The completion tape, and why its frame numbers are a contract

`test_advance_25m_ladder` is the one tape that proves a board is *completed* rather than
*entered*. It pokes exactly one thing — where Mario starts — and the walk, the ladder catch, the
climb and the rescue are all the game's own engine. (Poking Mario onto Pauline's platform also
fires the rescue, but that is a teleport into the rescue zone; it demonstrates nothing about
climbing.)

It is open-loop, so two measured numbers carry it and must not drift:

* **Ladder-X `0x92`** — 25m's right ladder to Pauline (record `@0x3af8`, interpolated to Mario's
  walk level). The Right window ends exactly when his X reaches it. Hold Right one frame too long
  and he walks past and off the girder; one frame short and he never catches it. An earlier
  attempt used `0x88`/`0x84` — about 10px short — and he stopped short of the ladder every time.
* **Start-Y `0x4a`** — settles onto the girder at `0x4c`. Poking Y to a value that is *not* a
  girder makes Mario **fall**, and he can neither walk nor climb while falling, so he lands stuck
  somewhere else entirely. Girder calibration at this X: `0x2a` is Pauline's platform, `0x4c` the
  girder directly below, `0x6b` two below.

Validated against MAME (`--seconds 34`, 2062 frames — the default 30s/1820-frame capture stops
*before* the advance): MAME and the JS engine agree frame-for-frame — rescue at frame 1612, board
1→4 at frame 1845 — and the pixel diff is **0.00% through the walk, the climb and the rescue**,
with the board transition at max 4.60% and zero frames over 5%.
