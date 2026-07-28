# The Pit — how it's played (outside-in, day-zero notes)

**Scope & method.** This is a *day-zero* description of how **The Pit** (Zilec Electronics / Centuri / Taito, 1982; MAME romset `thepit` / `thepitu1`) is *played*, assembled **only from public online sources** — Wikipedia, the Centuri fan site, the MAME/Arcade Database, and two hobbyist write-ups. It is what you'd write down **before** touching the ROM. Nothing here is derived from the disassembly, our own emulator, or any in-repo notes; that earned inside-knowledge is deliberately excluded so this stays a clean "what the public record says" baseline.

**Bottom line up front: the public record is thin.** A handful of sources agree on the premise and the marquee mechanics (dig down, grab a jewel, escape past a trap-floor "pit" before a tank blows up your ship). But on the details that matter to a faithful reimplementation — exact controls, lives, scoring tables, and especially *what a "level" is and how the game progresses* — the sources are sparse, second-hand, occasionally contradictory, and lean heavily on one hobbyist play-through. This scarcity is the point: this game had to be understood by hands-on grounding precisely because so little is documented. Every claim below is cited; gaps are called out explicitly.

---

## 1. The premise / objective

You play "**The Astronaut-Explorer**" (the game manual's term). Your spaceship lands on an alien / forbidden planet, and you must **dig down through underground tunnels to a bottom chamber, collect at least one large jewel (treasure), and then climb back up and return to the ship** — but the only way back aboard is by crossing a hazard room called **"The Pit."** [Wikipedia; Centuri fan site]

The Centuri flyer-style framing: you tunnel with laser assistance toward a treasure chamber, collecting **"Blue Gem Crystals"** along the way; an enemy ship lands too and rival explorers descend to steal the treasure; and "you must cross the deadly Pit to enter the ship." [Centuri fan site]

## 2. Controls

- **8-way joystick + a single action/fire button** is the layout reported by the Arcade Database (MAME) and by most secondary summaries. [Arcade Database (arcadeitalia); Wikipedia summary]
- **Conflict to flag:** at least one search-surfaced source described it as a **4-way** joystick + fire. The public record is not unanimous on stick type. *(Unresolved — verify against hardware.)*
- **Digging:** you move *slower* while digging through dirt than when walking an already-cleared tunnel, and you have to be **aligned precisely** to start digging into a cell — "some moves [are] tricky to perform." One hobbyist reviewer calls the controls "horribly twitchy," requiring "absolutely perfect pixel precision" to dig a space. [Wikipedia summary; Data Driven Gamer]
- **Shooting:** you fire a **laser that only travels horizontally** — you cannot shoot up or down. It's used to kill pursuing enemies ("you fire first, disintegrating the felon"), but turning to shoot is risky because of the twitchy controls. [Wikipedia summary; Centuri fan site; Data Driven Gamer]

*(No public source I found gives a button-by-button mapping, whether "dig" and "move" are the same input, or how firing interacts with movement direction beyond "horizontal only.")*

## 3. Hazards & enemies

- **Falling rocks / boulders** — digging can dislodge rocks that crush you or block the path. [Wikipedia; Centuri fan site]
- **Monsters / rival explorers** — enemies that can eat/kill you. One reviewer notes they "mostly wander aimlessly." You can shoot them (horizontally). [Wikipedia; Data Driven Gamer]
- **Arrows** — when you reach / disturb the bottom jewel chamber, **arrows start raining down**. [Wikipedia; Data Driven Gamer]
- **Acid** — a vat/pit of acid you can be melted in. [Wikipedia; Data Driven Gamer]
- **The "Pit" room (the signature hazard):** to get back to the ship you must pass through a room whose **floor is a sliding / retractable panel**; underneath is a **monster that devours you if you linger.** A reviewer pinpoints it as a **single-tile bottleneck above the acid pit that you *must* exit through, and the floor starts dropping the instant you enter, giving almost no time to line up.** [Wikipedia; Data Driven Gamer]
- **The Zonker (the "timer"):** instead of a countdown clock, a **tank called the "Zonker"** sits up top and slowly **shoots away a mountain next to your spaceship.** Dawdle in the maze and the Zonker eventually **destroys your ship, costing a life.** This is the game's pressure mechanic. [Wikipedia; Centuri fan site]

## 4. Scoring

Public scoring info is limited and comes in two only-partly-overlapping framings:

**Point values (per Wikipedia):**
- Enemy defeated — **200**
- Crystal collected — **1,000**
- Buried treasure — **2,000**
- Safely crossing The Pit and reboarding the ship — **1,000**
[Wikipedia]

**Jewel/bonus framing (per hobbyist play-through):** there are **7 diamonds** to collect in a run; **collecting 6 doubles your bonus, collecting all 7 triples it.** [Data Driven Gamer]

*(These two framings aren't fully reconciled anywhere public — "crystal" vs "diamond/jewel" vs "buried treasure" terminology is loose, and no source gives the full bonus/extra-life table.)* For scale only, the highest *officially recorded* score cited by the Centuri fan site is **177,900** (2004). [Centuri fan site]

## 5. Lives, progression, and "what a level is" — the murkiest part

This is where the public record is weakest, and where the sources most need to be taken with caution:

- **Lives:** a Wikipedia summary states **3 lives**, and — importantly — that **losing a life essentially restarts the run**: collected jewels are restored to their places and the tunnels you dug are erased (i.e. death resets the board, not just your position). [Wikipedia summary] *(Single, paraphrased source — treat as tentative.)*
- **Level structure:** the only source that addresses this directly is a hobbyist blog, which says there is effectively **"only one level, with only two possible boulder layouts, and everything is pretty deterministic."** [Data Driven Gamer]
- **Progression / difficulty:** per the same source, the game **doesn't add new levels — it just gets faster.** The reviewer completed "three full gem collections" before "the game got too fast to handle." So the loop appears to be: dig → grab jewel(s) → escape past the Pit → back to the ship → repeat the same board at higher speed for a bigger bonus. [Data Driven Gamer]

**⚠️ Big caveat:** the "one level, gets faster, board resets on death" picture rests almost entirely on a *single* enthusiast play-through, not on a manual or authoritative reference. Whether difficulty ramps by speed alone, whether enemy count/rock layout changes across loops, what the exact bonus/extra-life rules are, and how "a level completes" is scored — **none of this is well-established in public sources.** Verify all of it hands-on.

## 6. Hardware & lineage (for context — helps disambiguate the game)

- **Platform:** vertical (rotated) color raster arcade game; **256×224 display rotated 90°**, ~60.6 Hz. Upright and cocktail cabinets. 1–2 players (alternating). [Arcade Database; Centuri fan site]
- **CPU/sound:** the emulated set runs on **two Z80 CPUs** with an **AY-3-8910 PSG** for sound (mono). [Arcade Database]
- **MAME:** romset `thepit` (plus US set `thepitu1` and a bootleg `thepitb`). The Arcade Database lists the driver source as **`taito/roundup.cpp`**; other listings historically associate it with a **`thepit.cpp`** driver. *(Driver attribution is ambiguous across listings — note but don't rely on it.)* [Arcade Database; MAME search results]
- **Development/licensing history (interesting but second-hand):** designed by **Andy Walker and Tony Gibson**, developed by **AW Electronics**; released **~April 1982**. Published by **Zilec (UK)**, **Centuri (North America)**, **Taito (Japan)**. Reportedly the original ran on custom **6502** (Tangerine-based) hardware; **Centuri rewrote it for their Z80 board**, while the **Zilec/Zenitone** UK version was ported to **Galaxian-derived hardware** by brothers **Chris and Tim Stamper** (who later founded **Rare**). Note: MAME reportedly shows no significant hardware/version divergence despite this story. [Golden Age Arcade Historian; Wikipedia] Home ports followed on **Commodore 64 (1983)** and **VIC-20 (1984)**. [Wikipedia]

## 7. Don't-confuse-it-with

- **Round Up 5 – Super Delta Force** (Taito, unrelated driving game) — different game; the *name* collision matters because MAME's `roundup.cpp` driver groups The Pit with **Round-Up / Fitter** hardware. "Round-Up/Fitter" here is a *hardware* relative, not the same game as "Round Up 5."
- **Pitfall!** (Activision), **Pit-Fighter** (Atari), and the many modern "…Pit" titles — all unrelated to this 1982 dig-'em-up.
- **Dig Dug** (Namco, 1982) — a *contemporary* digging game often mentioned alongside it, but a different game.

---

## Sources

- The Pit (video game) — Wikipedia: <https://en.wikipedia.org/wiki/The_Pit_(video_game)> (and its mirror, HandWiki: <https://handwiki.org/wiki/Software:The_Pit_(video_game)>)
- The Pit — Centuri fan site: <http://www.centuri.net/thepit.htm>
- The Pit — Arcade Database (arcadeitalia, MAME data): <https://adb.arcadeitalia.net/dettaglio_mame.php?game_name=thepit>
- Data Driven Gamer — "Games 220-222: Zilec Electronics & Jetpac" (hobbyist play-through): <https://datadrivengamer.blogspot.com/2020/12/games-220-222-zilec-electronics-jetpac.html>
- The Golden Age Arcade Historian — Allied Leisure/Centuri history (licensing/hardware lineage): <http://allincolorforaquarter.blogspot.com/2014/01/the-ultimate-so-far-history-of-allied.html>
- Gameplay video reference (not transcribed here): The Pit [Arcade Longplay] (1982) — <https://www.youtube.com/watch?v=i-xgnile9Rk>

**Sources that would have helped but were unreachable** (HTTP 403/402 at time of research — could not verify their specifics): arcade-museum.com / KLOV, arcade-history.com, MobyGames, Codex Gamicus / Gamia Archive (Fandom), gamesdatabase.org. The scarcity and unreachability of authoritative gameplay documentation is exactly why this game ultimately had to be understood through hands-on emulation rather than from the public record.

---
*Outside-in artifact. Everything above is public-sourced and cited; where sources are single, second-hand, or contradictory it is flagged as such. Do not treat §5 (progression/lives) or the exact scoring in §4 as authoritative — those are the biggest public gaps.*
