9009	rebuild the per-wave enemy state tables
900c	lay out this wave's per-lane spikes
900f	clear working RAM for the state being entered
9012	drop the paired ready latches
9017	prime the tube-depth counter high byte to 250
901b	clear the moving-spike active flag
901e	clear the tube-depth counter low byte
9022	reset the mode-dispatch selector
9025	arm the per-frame control timers and plant the blaster's start pose
9028	rebuild the enemy state tables from the record tables
902b	wipe the active-shot bank
902e	clear the per-slot depth table and the enemy population counts
9031	give each active enemy slot a fresh random tag
9034	clear the shape-active table and its object count
9037	zero the spinner accumulator
903a	rebuild the level layout
903f	arm the rim-color animation cursor high
9042	arm the enemy-animation accumulator high
9047	clear the spiked-segment count
904d	set the player-shot depth to the near/rim end
9056	read the level's signed tube-geometry scale delta
905d	sign-extend the delta when negative
906e	fold the scaled delta into the running zoom/position accumulator
9076	carry it up through the projection-offset low byte
907c	and the projection-offset high byte
9083	advance the tube-depth position by a fixed stride
908b	carry into the depth high byte
9093	arm the descending-spike table guard once the depth reaches the far limit
9099	measure the remaining distance to the target depth
90a1	skip the snap until the depth window collapses
90a5	snap the position onto the target depth
90ad	pick the next game mode by the play/active state bit
90b3	commit the chosen game mode
90b9	clear the active seat's cell
90be	flag the frame dirty for redraw
90c1	place the blaster on the now-advanced rim
90c4	read the wave start-slot seed
90ca	scan the slot-threshold table for the deepest slot at or below the seed
90cf	start the depth floor at 4
90d4	test the difficulty switch that ratchets the start deeper
90d8	read the current wave number
90df	push the floor one deeper past wave 48
90e4	again past wave 80
90e9	again past wave 112
90ec	test the cabinet configuration for the deep-start override
90f2	force the start floor to 27
90f4	publish the depth floor
90fa	clamp the start slot up to the floor
90fc	store the wave start-depth ceiling
9105	retire the seed so it does not carry into the next wave
9108	latch the active level seat from the current level id
910e	swap in the level's parallel lane tables
9113	seed the spread coordinate
9117	set the tube-depth high byte to the far end
911b	reset the player's rim segment
911e	clear the rim rotation offset
9120	clear the spread coordinate low byte
9122	clear the pass counter
9127	branch unless this is a level intro
912b	arm the intro pass counter to 20
9130	raise the tube-geometry flag
9135	enter the level-intro mode
9139	set the mode-dispatch selector
913d	clear the wave-progress index
913f	unpack the level nibble tables
9144	store the mode-delay timer
9146	zero the spinner accumulator
9149	tick down the frame counter and act only on underflow
9152	decimal-decrement the intro/spawn phase
915b	on phase underflow set the spawn gate bit
9161	at phase 3 cue the level-intro sound
9166	reload the frame counter to 20
9169	nudge the blaster's rim position
916c	pick the spawn edge mask by phase
9178	spawn only if a masked edge flag is set
917c	clear the edge flags
917e	read the player's rim segment
9184	record the player segment against the active seat
9187	take the start slot from the threshold table by segment
918c	off the play-state sign take a random slot instead
9190	mark the slot countdown
9195	pull a random 0..7 from the POKEY RNG
9197	store the chosen slot into the per-slot level table
9199	and into the wave-progress index
919b	unpack the level nibble tables
919e	rebuild the enemy state tables
91a1	lay out the per-lane spikes
91a4	drop the paired ready latches
91a9	set the active-play game mode
91ab	zero the spinner accumulator
91b0	keep only the low 3 edge bits for the next frame
91b5	double the selector into a two-byte table offset
91b9	clear the flag byte paired with this pointer
91bb	copy the selected structure's pointer low byte from the in-page table
91c0	copy its pointer high byte
921d	seat the blaster at the starting rim segment
9222	set the rim fine-rotation offset
9226	disarm the moving spike
922b	set the player's fine rotation angle
9230	set the player-shot depth to the rim end
9234	read the wave's initial active-slot count
9237	seat it as the per-lane header count
923a	read the per-lane fill constant
923f	fill all sixteen lane cells with the constant
924a	clear the 64-byte slot tag/record table
9250	start at the top active slot
9254	take a 4-bit POKEY random for this slot
9259	stash the random nibble in the slot's index cell
925d	pack the slot index with its random nibble
9266	substitute 0x0f so a live slot never carries an all-zero tag
9268	store the packed slot tag
9273	clear the seven-cell per-slot depth table
9279	clear the total enemy count
927c	clear the enemy-type count
927f	clear the five per-lane enemy counts
9293	clear the 12-entry per-slot shot-state array
9299	clear the active object count
929c	clear the active enemy count
92a3	clear the eight-cell shape-active table
92a9	clear the timed-object count
92af	zero the spinner accumulator
92b4	swap the two parallel 18-entry lane tables slot for slot
92c5	read the wave-progress index as the difficulty key
92c9	branch unless the key runs off the top of the tables
92cb	substitute a POKEY random key when off the top
92d2	store the difficulty search key
92d4	bump it by one
92d8	start the record walk at index 111
92dc	read the record's destination pointer high byte
92e1	and its low byte
92e6	read the source-list pointer high byte
92eb	and its low byte
92f2	reset the per-record scan cursor
92f6	read the next source-list entry
92fb	end the list on a zero entry
9300	compare the key against the range low bound
9305	compare against the range high bound
930a	skip this range if the key is outside it
930d	resolve the value for this destination cell
9313	advance the cursor to the next range
931b	store the resolved byte through the destination pointer
9320	step to the next record, four bytes back
9326	loop until the record table is exhausted
932b	select the enemy-speed rescale by difficulty mode
9331	easy mode: lower the free-flight slot ceiling
933f	ramp the segment-0 climb speed down
9348	ease the early waves further
934d	hard mode?
9351	raise the free-flight slot ceiling
935d	clamp the ceiling to 3
936b	ramp the segment-0 climb speed up
9377	raise the wave's initial active count
937f	select the hard-mode alternate list set
9385	fold the segment-3 climb delta into fine and coarse seeds
9388	store the segment-3 climb-delta low byte
938b	store the segment-3 climb-delta high byte
938e	store the segment-3 band threshold
9394	fold the object velocity into fine and coarse seeds
9397	store the object-velocity low byte
939a	store the object-velocity high byte
939d	store the hit-distance threshold
93a2	fold the segment-0 climb delta into fine and coarse seeds
93a5	store the segment-0 climb-delta low byte
93a8	mirror it into the segment-2 climb delta
93ab	store the segment-2 climb-delta high byte
93ae	store the segment-0 climb-delta high byte
93b1	store band threshold 0
93b4	store band threshold 2
93b7	store band threshold 1
93be	derive the segment-4 climb delta by doubling segment-0
93c5	and its high byte with the carry
93ca	hard-seed band threshold 4
93cf	hard-seed the segment-1 climb-delta low byte
93d4	and its high byte
93d9	seed the first candidate lane
93dc	seed the second candidate lane
93e0	seed the bit-fold accumulator with 0xff
93e2	hold the running seed in scratch
93e4	shift the source byte's top bit out
93e5	fold that top bit into the seed's low end
93e7	shift the next source bit out
93e8	fold it into the seed
93ea	shift the third source bit out
93eb	fold it into the seed
93ed	take the finished fine seed into Y
93f1	complement the seed
93f4	bias the complement by 0x0d
93f6	halve it to form the coarse index
9677	load the coordinate-value helper selector
967a	read the chosen helper's return-address high byte
967e	read its low byte
9682	computed jump into the selected coordinate-value helper
9683	load the cursor-advance helper selector
9686	read the chosen advance helper's high byte
968a	read its low byte
968e	computed jump into the selected cursor-advance helper
96ab	read the list counter
96ae	counter minus one
96b0	wrap into the low nibble
96b3	plus one -- the counter-derived seed
96b5	join the shared re-index
96b7	index variant -- seed from the raw counter instead
96b9	stash the incoming cursor
96bb	step back one entry
96bc	step back a second entry
96be	subtract the stride byte two entries back
96c1	add the saved cursor back in
96c4	load the coordinate-list entry the offset points at
96c7	first entry -- advance the cursor by one
96c8	advance the cursor two past a packed record
96cb	read the coordinate entry under the cursor
96cd	back up to the predecessor entry
96cf	subtract it -- the inter-entry stride
96d1	publish the stride delta in scratch
96d5	advance the cursor forward by the stride
96d8	leave the cursor one past
96d9	leave it two past, ready for the next entry pair
96db	read the relative list entry
96de	fold it onto the anchor base for the absolute coordinate
96e2	get the repeat count for this run
96e6	seed the total with the first entry
96e8	step to the next entry
96e9	test the count
96eb	nothing to add when the count is zero
96ed	add the next entry into the running total
96f0	drop the count
96f1	repeat until the run is summed
96f4	read the scratch base value
96f6	record the cursor so the caller can recover it
96f8	step back one slot
96f9	step back a second slot
96fb	base minus the list byte two slots back -- the delta
9705	even delta -- fetch the entry as-is
9707	odd delta -- step one slot forward
9708	load the entry the cursor now points at
970b	rotate the player's blaster around the rim
970e	seat a newly spawned enemy into a free slot
9711	advance the attract-mode enemy sweep timer
9714	count down the per-slot spawn timers
9717	run every occupied slot's motion script
971a	advance the active shots
971d	spawn climbers up the lanes from their source slots
9720	proximity and collision scan across all slots
9723	age the transient timed objects
9726	tail into aging shots and ticking the frame clock
9729	read the spiked-segment tally cell
972c	clear its per-frame high bit, keep the tally
972e	write back the clean count
9731	turn the spinner/aim into the player's new rim angle
9734	step the moving spike
9737	age the timed objects
973a	seat a new enemy into a free slot
973d	advance the live shots
9740	read the fine-angle rotation-pending flag
9743	skip the extra pass unless its high bit is set
9745	extra pass -- age shots and tick the frame clock
9749	read the fine-angle rotation-pending flag
974c	proceed only when no rotation is pending
974e	pending or locked -- do nothing this frame
9751	read the status flags
9753	manual-play bit set -- take the raw spinner delta
9755	aim mode -- auto-aim delta toward the nearest enemy
9759	join the offset computation
975b	manual play -- read the raw spinner delta
975d	positive delta -- go cap it
975f	negative delta below the floor
9763	floor the delta at 0xe1
9768	positive delta at or below the cap
976c	cap the delta at 0x1f
976e	consume the spinner reading -- zero it
9770	stash the chosen turn delta
9775	form rim-offset minus the delta
9777	provisional new rim offset
9779	read the live-board tube-geometry flag
977c	skip the end-of-rim clamps when no board is live
977e	offset short of the top limit
9782	cap the offset to the top lane
9786	compare the offset's sign against the delta
9788	same sign -- no over-rotation, continue
978a	compare the offset's sign against the old offset
978e	same sign -- continue
9790	pick the saturation end by the old offset's sign
9794	saturate to the bottom end of the rim
9799	saturate to the top end of the rim
979d	take the offset's high nibble
97a3	store it as the coarse lane
97a6	pair the fine angle as high-nibble plus one
97aa	store the fine angle
97ac	compare the new coarse lane against the current segment
97b1	unchanged -- skip the movement sound
97b3	crossed into a new lane -- ring the rim-movement sound
97b8	commit the coarse lane as the player's segment
97bd	commit the fine angle
97c2	carry the rim offset to the next frame
97c5	seed the shallowest-depth-seen with 0xff
97c9	seed its slot index with none
97cb	start at the top enemy slot
97ce	read the slot's depth
97d1	empty slot -- skip it
97d5	not shallower than the best -- skip it
97d7	record the new shallowest depth
97d9	record its slot index
97db	step down to the next slot
97dc	keep walking while the index stays non-negative
97de	no candidate found -- return the last depth read
97e2	read the nearest enemy's segment
97e5	read the player's segment
97e8	signed segment delta between them
97ec	already aligned -- turn code zero
97ee	enemy on one side versus the other
97f0	turn code for one direction
97f5	turn code for the other direction
97f8	read the field-transition gate -- spike stepping is frozen while the player field is mid-transition
97fb	run the spike only while the field is settled
97fe	read the spike arm flag
9801	step the spike only while it is armed
9804	at the trigger height 0x10...
980b	cue the spike's rising start note, exactly once at trigger height
980e	advance the spike height low byte by the per-frame growth step
9812	add the step low byte
9815	store the spike height low byte
9818	carry into the spike height high byte
981b	add the step high byte
981e	store the spike height high byte
9821	spike overflowed past the top -> retire it
9823	still below the 0xf0 ceiling -> keep growing
9827	request game mode 0x0e -- the spike has reached the top
982b	cue the spike's end sound
982e	pin the height at max so it stops climbing
9833	once the spike passes the 0x50 reset height...
9836	compare against 0x50
9838	below it -> skip the table rebuild
983a	...and the spike-table guard is clear...
983d	guard set -> skip
983f	rebuild the on-screen spike table
9842	step the depth-shading accumulator low byte by the same growth step
9845	add the step low byte
9848	store the accumulator low byte
984a	carry into the accumulator high byte
984c	add the step high byte
984f	no overflow -> skip the page byte
9851	page the depth accumulator's extra byte on overflow
9853	did the depth high byte move this frame?
9855	unchanged -> skip the redraw bump
9857	bump the redraw counter so the depth-shaded view refreshes
985a	store the depth accumulator high byte
985c	take the step source cell
985e	scale it by 4
9860	clamp the scaled step source to 0x30
9864	clamp to 0x30
9867	bias by a minimum climb rate
986a	fold the new step into the growth step low byte
986d	store the step low byte
9870	carry into the growth step high byte
9875	store the step high byte
9878	no collision test once the spike has parked at the ceiling
987d	parked -> done
987f	scan the 16 lane-height cells from the top down
9881	read this lane's stored spike height
9884	empty lane -> skip
9886	only the player's own lane can be hit
9889	other lane -> skip
988b	spike hasn't grown past the player yet -> skip
988e	not yet -> skip
9890	cue the spike collision sound
9893	drop an object-head marker at the hit
9896	clear the spike-table guard
989b	clear the player's live shots
989e	next lane
989f	loop the lane scan
98a2	clear the spike-lane mask accumulator
98a7	sum the active-enemy and enemy-type counts
98ab	add the enemy-type count
98ae	compare the pair against the slot ceiling
98b1	within budget -> no freeze from crowding
98b3	exactly at the ceiling -> no freeze
98b5	overcrowded -> raise the ageing-freeze gate
98b7	a latched wave transition...
98ba	none -> leave the gate as is
98bc	...also freezes timer ageing
98be	store the freeze gate
98c0	walk the 64-entry spawn-timer table from the top
98c2	read this slot's timer
98c5	empty slot -> skip
98c7	freeze gate raised -> don't age this slot
98cb	age the timer down by one
98ce	store the aged timer
98d1	reached zero?
98d3	timer expired -> fire the spawn handler for this slot
98d9	just crossed into the mask band at 0x3f?
98db	no -> skip the hold check
98dd	read this slot's lane index
98e0	fold the mask
98e6	take this lane's bit from the lane-bit table
98e9	lane not already carrying a spike -> leave it
98eb	lane already busy -> hold the timer back at 0x40
98ee	re-read the timer and classify it
98f1	compare against 0x40
98f3	below 0x40 -> mask band
98f5	on the high band, act only on even frames
98f9	odd frame -> hold
98fb	rotate this slot's lane index by one, mod 16
9903	store the rotated lane index
9909	in the 0x20..0x3f band?
990b	below 0x20 -> skip
990d	take this lane's bit
9910	from the lane-bit table
9913	set this lane's bit in the spike-lane mask
9916	store the mask accumulator
9919	next slot
991a	loop the slot scan
991c	publish the rebuilt spike-lane mask for the rest of the frame
991f	store the published mask
9923	raise the spawn request with its depth seed 0xf0
9925	store the request depth
9927	stage this slot's lane/segment for the spawn
992a	store the staged segment
992c	save the slot index across the placement pass
992e	run the per-column spawn placement
9931	reload the saved slot index
9933	spawn request still live?
9935	cancelled by placement -> fail path
9937	try to seat a climber in a free enemy slot
993a	no free slot -> fail path
993c	spend a fire-gate credit
993f	clear this slot's timer -- the spawn is done
9941	clear the slot timer
9945	flag the placement failed, freezing the rest of the scan
9947	store the freeze flag
9949	re-arm the slot timer to retry later
994d	park the caller's scan index
994f	scan enemy slots from the top down
9952	read this slot's depth cell
9955	slot occupied -> keep scanning
9957	seat the new enemy's depth from the staged request
9959	store the enemy depth
995c	staged segment 0x0f...
995e	compare against 0x0f
9960	not 0x0f -> take the segment as staged
9962	...and a closed tube...
9965	open tube -> keep the segment
9967	...replaced by a random even lane so spawns spread across the rim
996a	random even lane
996c	seat the enemy's tube segment
996f	animation phase...
9970	segment + 1
9972	mod 16
9974	seat the enemy's animation phase
9979	clear the enemy's timer
997c	seat the coordinate-list pointer low byte for this enemy
997e	store the pointer low byte
9981	seat the coordinate-list pointer high byte
9983	store the pointer high byte
9986	one more active enemy
9989	take the staged flag byte
998b	seat the enemy's flag byte
9990	lane = low 3 bits of the flag byte
9995	bump this lane's enemy count
999a	report a successful spawn
999d	step down and continue the free-slot scan
999e	loop the scan
99a2	report no free slot found
99a9	clear the five-column deficit table
99b1	this column's enemy target
99b4	minus the enemies already on the lane
99b8	negative deficit -> leave this column at zero
99ba	store the column's deficit
99c0	walk every enemy slot
99c3	skip empty slots
99c8	take this enemy's lane, low two bits
99cd	lane 0 -> skip
99d0	lane 3 remaps to column 5
99d6	deduct 2 from that column's budget for this in-flight enemy
99d9	deduct the second unit
99dc	next slot
99e1	global cap = slot ceiling plus one...
99e5	plus one
99e8	...minus the total lane occupancy
99f0	clamp each column's deficit down to the cap
99f5	store the clamped deficit
99ff	count the nonzero columns
9a04	one more nonzero column
9a08	no column needs enemies -> clear the request
9a0b	two or more columns -> multi-column path
9a10	single column: find the column with a deficit...
9a15	...that also has a spawn-cap entry
9a18	none -> keep looking
9a1a	seat a spawn list on that column
9a1d	no placement -> keep looking
9a1f	placed -> done
9a24	exhausted -> clear the request
9a26	record the column count minus one
9a2a	multi-column: skip empty columns
9a2f	skip columns already at their cap
9a32	compare occupancy to the cap
9a37	seat a spawn list on the first below-cap column
9a3a	no placement -> keep looking
9a3c	placed -> done
9a40	if columns 3 and 2 both still owe enemies...
9a45	both live?
9a4a	read the staged lane's stored height
9a4f	nonempty -> use it
9a51	default to 0xff when the lane is empty
9a55	pick column 3 or 2 by the 0xcc height threshold
9a5b	seat a spawn list on the chosen column
9a5e	no placement -> fall through
9a60	placed -> done
9a61	POKEY-random start column for the round-robin sweep
9a67	step to the start column
9a68	sweep all five columns
9a6a	column has a spawn-cap entry...
9a6d	none -> next
9a6f	...and a deficit...
9a72	none -> next
9a74	...seat a spawn list on it
9a77	no placement -> next
9a79	placed -> done
9a7b	wrap the column index
9a80	next column
9a82	no placement made: clear the spawn request flag
9a84	store the cleared flag
9a87	take the column number as the dispatch selector
9a88	double the selector to a two-byte table offset
9a8a	push the selected setup entry's address high byte...
9a8e	...and its low byte
9a92	return jumps into the selected coordinate-list setup entry
9a9d	coordinate-list pointer low from the fixed table head
9aa0	store the pointer low byte
9aa2	high byte from the runtime-steered source cell
9aa5	selecting index 0
9aa7	finish via the shared seater's high-byte tail
9aa9	compose the pointer low byte from a table byte OR'd with the list-select flags
9aac	OR in the list-select flags
9aaf	selecting index 1
9ab1	finish via the shared seater with the computed low byte
9ab3	selecting index 4
9ab5	into the shared seater
9ab7	selecting index 3
9ab9	into the shared seater
9abb	POKEY-random start lane
9abe	low two bits -> candidate index 0..3
9ac1	set a four-attempt countdown
9ac5	stash the caller's index
9ac7	count down an attempt
9ac9	attempts remain?
9acb	restore the caller's index
9acd	report no eligible lane
9ad0	step the candidate index down...
9ad3	...wrapping to the top
9ad5	read the candidate lane id from the table
9ad8	remap candidate lane 3 to 5
9adc	lane 5
9ade	reject an empty lane and try again
9ae3	restore the caller's index
9ae5	form the pointer low byte: chosen lane OR 0x40
9ae8	OR in 0x40
9aea	selecting index 2
9aec	finish via the shared seater with this low byte
9aee	coordinate-list pointer low from the ROM table
9af1	install the pointer low byte
9af3	coordinate-list pointer high from the ROM table
9af6	remember the selecting index
9af8	install the pointer high byte
9afa	reload the accumulator from its holding cell
9b07	save the caller's index across the setup
9b09	held count at or above 0x20?
9b0b	compare against 0x20
9b0d	the packed list index
9b0f	high count -> route through the setup dispatcher
9b12	else seat the pointer directly at that index
9b18	route the index through the setup dispatcher
9b1b	restore the caller's index
9b1e	skip the slot walk while the player field is mid-transition
9b23	seed the slot loop from the top slot
9b2a	skip empty slots
9b2f	raise the script-walk continue flag
9b31	store the continue flag
9b34	load this slot's saved script cursor
9b37	store the working cursor
9b3a	the current cursor
9b3e	read the motion opcode at the cursor
9b41	dispatch the motion opcode for this slot
9b44	advance the script cursor
9b47	keep walking until a handler ends the script
9b4c	store the advanced cursor back to the slot
9b4f	store the cursor
9b52	next slot
9b54	loop the slot scan
9b56	signed-accumulate the sweep step into the sweep accumulator
9b5a	add the step
9b5e	did the accumulate cross a sign boundary?
9b61	store the new sweep accumulator
9b64	no sign change -> skip the sweep cues
9b66	accumulator turned negative...
9b69	cue the segment/collision sound as the sweep turns negative
9b6f	lanes populated...
9b72	empty -> skip
9b74	...and the field settled...
9b77	mid-transition -> skip
9b79	...cue the motion-flip sound
9b7c	check the sweep accumulator against its band
9b7f	negative side -> test the low bound
9b81	inside [0x0f,0xc0] -> reverse the sweep
9b83	at or above 0x0f -> reverse
9b88	outside the band -> leave the direction
9b8a	at or above 0xc1 -> leave
9b8c	negate the sweep step to reverse the field's breathing
9b8f	one's-complement
9b92	plus one
9b94	store the reversed sweep step
9b98	the pre-doubled opcode as a table offset
9b99	push the selected motion handler's address high byte...
9b9d	...and its low byte
9ba1	return jumps into the selected motion handler
9bcc	clear the walk-continue flag to end this object's script
9bd0	advance the motion-script cursor one byte
9bd3	load the cursor as the table index
9bd6	fetch the literal byte the cursor now points at from the motion-script table
9bd9	store that constant into the acting slot's cell
9bdd	advance the motion-script cursor one byte
9be0	load the cursor as the table index
9be3	fetch the script byte -- here a zero-page pointer, not a value
9be7	read the live zero-page variable the script byte points at
9bea	copy that variable's current value into the acting slot's cell
9bee	read the script branch-test flag
9bf1	flag set: leave the cursor put -- the operand is consumed on the taken path
9bf3	flag clear: step the cursor past the...
9bf6	...two-byte operand
9bfa	advance the script cursor one
9bfd	read the branch-suppress flag
9c00	flag set: suppress the jump and fall through to the next entry
9c05	read the jump target from the script table at the new cursor
9c08	reload the cursor with the target -- the scripted jump
9c0c	count this slot's dwell timer down one frame
9c0f	still dwelling: re-run the current script state
9c11	timer expired: release the script to the next instruction
9c17	current script position
9c1a	read the goto target from the parallel goto table
9c1d	write it back as the new cursor -- the unconditional goto
9c21	read slot x's tube segment
9c24	index that segment's boundary depth in the per-lane limit table
9c27	nonzero limit: use it
9c29	a zero entry means no limit -- read as the maximum depth
9c2b	compare the boundary against the slot's depth
9c2e	boundary at or beyond the depth: flag 1
9c30	else flag 0
9c35	boundary reached: flag 1
9c37	leave the 1/0 verdict in the script branch flag
9c3b	read the per-frame enemy animation delta
9c3e	scale the delta by four
9c41	add the animation-phase accumulator
9c44	AND with the accumulator to isolate the shared sign
9c47	keep just the high sign bit
9c49	invert it
9c4b	leave the phase-sign verdict in the script branch flag
9c4f	read slot x's flag byte
9c52	invert bit6 -- the rim turn side
9c54	store the flipped turn side back
9c58	read slot x's flag byte
9c5b	low 3 bits are the lane segment -- the per-segment speed-table index
9c5e	read the slot's direction byte
9c61	bit7 set: take the reverse (retreat) path
9c63	low byte of the slot's 16-bit tube depth
9c67	add the per-segment climb-speed low byte
9c6a	store the depth low byte
9c6d	depth high byte
9c70	add the per-segment climb-speed high byte with carry
9c73	store the depth high byte -- enemy advanced toward the rim
9c76	compare against the shared shot/floor depth
9c79	at the floor
9c7b	past the floor: carry on
9c7d	reached the floor: settle the enemy at target depth
9c83	high byte still above 0x20?
9c85	yes, still deep: done
9c87	read the direction byte
9c8a	the replacement/split gate bits
9c8c	gate clear: done
9c91	retire the enemy and spawn its split/replacement
9c99	depth low byte
9c9d	subtract the per-segment climb-speed low byte
9ca0	store the depth low byte
9ca3	depth high byte
9ca6	subtract the climb-speed high byte with borrow
9ca9	store the depth high byte -- enemy retreats up the tube
9cac	underflowed past the far rim?
9cae	no underflow: done
9cb0	clamp value
9cb2	floor the depth at the far rim (0xf2)
9cb6	default steering index
9cb8	read the slot's direction byte
9cbb	bit7 set: retreating slot, take the sub-step path
9cbd	depth high byte
9cc0	compare against the near-rim threshold
9cc3	below threshold: keep steering index 1
9cc5	at or over threshold: steering index 0
9cc7	add-step the depth forward one tick
9ccd	sub-step the depth backward one tick -- retreat
9cd0	read the enemy-fire gate
9cd3	gate armed: probe with the stepped depth
9cd5	gate clear: probe as the far value
9cd7	compare the probe against the near threshold
9cda	not yet at the far threshold: on to the tail
9cdc	reached the threshold: read the direction byte
9cdf	flip the climb-direction bit
9ce1	reverse the slot's travel direction
9ce4	read the animation accumulator
9ce7	busy (bit7 set): bail
9ce9	depth high byte
9cec	near-rim threshold
9cef	not close enough: bail
9cf1	player's segment
9cf4	same lane as this enemy?
9cf7	wrong lane: bail
9cf9	player's fine angle
9cfc	matches the enemy's phase/angle?
9cff	wrong angle: bail
9d01	enemy is on the player: seed a fresh object for the slot
9d06	read the shared floor/shot depth
9d09	stash it as this slot's depth
9d0c	read the flag byte
9d0f	low 3 bits: the lane kind
9d11	kind 1?
9d13	not kind 1: skip the fire flip
9d15	read the enemy-fire gate
9d18	gate clear: skip
9d1a	read the direction byte
9d1d	flip the climb direction -- turn to fire
9d1f	store it
9d23	read the flag byte
9d26	positive slot: go to the split logic
9d28	negative slot: nudge its stashed depth and stop
9d2c	drop the total live-enemy count
9d2f	read the per-type enemy count
9d32	exactly one of this type?
9d34	yes: scan for a matching neighbour
9d36	otherwise re-aim the slot toward the player
9d3c	scan from slot 6 downward
9d3e	read the candidate slot's depth
9d41	empty slot: skip it
9d43	record the current scan index
9d45	is it this same slot?
9d47	self: skip
9d49	candidate depth
9d4c	matches the shared floor depth?
9d4f	match: take this neighbour
9d51	next slot down
9d52	keep scanning while slots remain
9d54	read the matched neighbour's flag byte
9d57	its turn-side bit
9d59	inverted
9d5b	set this slot's turn side opposite the neighbour's
9d5e	script-cursor seed
9d60	point the motion-script cursor at 0x41
9d63	bump the per-type enemy count
9d67	read slot x's own segment
9d6b	player's segment
9d6e	signed ring distance from the player to this enemy
9d71	shift the sign into carry
9d72	read the flag byte
9d75	distance negative: clear the turn-side bit
9d77	else set bit6 -- turn toward the player
9d7c	clear bit6 -- turn the other way
9d7e	store the turn-side decision
9d82	read the slot's phase counter
9d85	read the flag byte
9d88	bit6: which way the phase steps
9d8a	bit6 set: step the phase down
9d8c	bit6 clear: step the phase up
9d90	step the phase down
9d92	keep the low nibble
9d94	force bit7 active
9d96	store the advanced phase
9d99	read the flag byte
9d9c	low 3 bits: the animation state
9d9e	settling state (4)?
9da0	not settling: re-aim/walk branch
9da2	settling: read the phase
9da5	at a step boundary?
9da7	not on a boundary: done
9da9	read the phase
9dac	phase bit3?
9dae	clear: skip the lane rotate
9db0	read the segment
9db4	plus one lane
9db6	wrap to the 16-lane ring
9db8	rotate the enemy up one lane
9dbb	read the flag byte
9dbe	drop bit7
9dc0	mark the flip settled
9dc3	reseed value
9dc5	reset the phase to 0x20
9dc8	read the direction byte
9dcb	flip the turn sign
9dcd	store it
9dd0	read the enemy-fire gate
9dd3	gate armed: done
9dd5	read the flipper's depth
9dd8	at the player's floor depth?
9ddb	no: just isolate the direction sign
9ddd	at the player: lunge across toward the target lane
9de3	read the direction byte
9de6	keep just the sign bit
9de8	mask the direction down to its sign
9dee	not settling: read the segment
9df1	read the flag byte
9df4	flip bit6 for the heading lookup
9df6	look up the target ring heading
9df9	does it match the current phase?
9dfc	no: done for this frame
9dfe	read the flag byte
9e01	drop bit7
9e03	clear the active bit
9e06	test the turn-side bit
9e08	set: take the +1-lane branch
9e0a	read the segment
9e0d	copy the segment into the phase
9e11	minus one lane
9e13	wrap the ring
9e15	step the segment down one lane
9e1b	read the segment
9e1f	plus one lane
9e21	wrap the ring
9e23	set the phase to the next lane up
9e26	read the flag byte
9e29	isolate bit7 active
9e2b	copy it into the shared script branch flag
9e2f	read this slot's enemy state byte
9e32	bail if the slot is already live -- only act on a not-yet-live slot
9e34	read the slot's segment
9e37	compare against the player's current rim segment
9e3a	bail unless the slot's segment matches the player lane
9e3c	read the slot's phase/successor heading
9e3f	compare against the player fine-angle cell
9e42	bail unless it matches too
9e44	on a full coordinate match, spawn the type-5 object and drain the pending queue
9e48	read the slot's tube-depth high byte
9e4b	compare with the player shot depth
9e4e	bail unless the depth matches
9e50	read the slot's segment
9e53	compare with the player rim segment
9e56	bail unless the lane matches
9e58	register the hit on the player and insert the object head tag
9e5c	run the depth-gated flip-bit keeper first, then fall into the segment step
9e5f	read the enemy state byte
9e62	mark the slot live -- set bit7
9e64	store it back
9e67	isolate the low-3-bit segment kind
9e69	is this segment kind 4
9e6b	branch to the ordinary-segment case if not
9e6d	reload state for the kind-4 case
9e70	test the turn-side bit
9e72	branch by side
9e74	heading 0x81 for one side
9e79	read the segment for the other side
9e7d	step the segment down one
9e7f	wrap mod 16
9e81	store the stepped segment
9e84	heading 0x87 -- the bit6-set variant
9e86	store the phase/heading
9e8c	reload state for the ordinary-segment case
9e8f	test the turn-side bit
9e91	skip the step-up if the side bit is clear
9e93	read the segment
9e97	step the segment up one
9e99	wrap mod 16
9e9b	store the stepped segment
9e9e	reload state for the heading lookup
9ea1	index by the current segment
9ea4	look up the ring heading
9ea7	store the heading into the phase cell
9eab	read the tube-geometry / live-board flag
9eae	do nothing unless the board is live
9eb0	read the enemy state byte
9eb3	test the flip/turn-side bit
9eb5	branch if the bit is clear
9eb7	bit set: read the segment depth
9eba	has it reached 0x0e
9ebc	keep the bit while depth is below 0x0e
9ebe	else reload state to clear the flip bit
9ec1	clear bit6
9ec3	store it back
9ec9	bit clear: read the segment depth
9ecc	leave it clear unless depth is 0
9ece	at depth 0, reload state to set the flip bit
9ed1	set bit6
9ed3	store it back
9ed7	test the caller's turn-side bit
9ed9	straight lookup when clear
9edb	half-turn: step the index back one
9edd	wrap the index mod 16
9ee0	read the ring-direction table
9ee4	add a half turn (8)
9ee6	wrap mod 16
9eeb	straight case: read the ring-direction table
9eee	force bit7 on the heading
9ef1	select climb-delta table entry 4
9ef3	read the enemy direction/state byte
9ef6	take the re-seek path when the climb-direction bit is set
9ef8	read the depth low byte
9efc	add the per-segment climb-speed delta (low)
9eff	store the depth low
9f02	read the depth high byte
9f05	add the climb-speed delta (high) with carry
9f08	store the depth high
9f0b	compare against the player-shot floor depth
9f0e	branch if at or above the floor
9f10	else clamp depth to the floor
9f13	store the clamped depth
9f19	read the enemy-fire gate
9f1c	no fire step when the gate is closed
9f1e	read zero-page scratch $9f
9f20	compare it against 0x11
9f22	arm the fire step when it is high enough
9f24	else arm the fire step once depth reaches 0x20
9f2a	with the fire carry, take the fire step
9f2c	read the fire/aim selector
9f2f	pick the turn side by its sign
9f31	flip the enemy toward the target lane
9f37	else flip to a random side
9f3d	run the fire-gate step
9f43	re-seek path: step depth in the lane direction (subtract way)
9f46	test the returned depth high byte
9f48	low half -> fire step
9f4a	test the fire/aim selector bit6
9f4f	flip toward the target lane
9f55	else flip to a random side
9f5b	fire-gate step
9f5f	read the slot's depth high byte
9f62	test the fire-enable bit
9f64	no step unless the bit is set
9f66	draw a fresh secondary-RNG byte
9f69	compare against the fire threshold
9f6c	no fire when the draw is under threshold
9f6e	test the fire/aim selector bit6
9f74	test the slot index parity
9f75	even slot -> flip to a random side
9f77	else flip toward the target lane
9f7d	flip to a random side
9f81	re-derive this slot's turn side to face the player segment
9f84	toggle the slot's turn-side bit
9f87	into the shared flip tail
9f8a	read the enemy state byte
9f8d	clear the turn-side bit
9f8f	test a primary-RNG bit (bit6)
9f92	leave the side clear on a 0 draw
9f94	else set the turn-side bit from the random draw
9f96	store the reseeded state
9f99	shared tail: read the live-board flag
9f9c	skip the ring-depth flip on a dead board
9f9e	read the state byte
9fa1	test the turn-side bit
9fa3	branch by side
9fa5	side clear: read the segment
9fa8	compare with 0x0f
9faa	flip the bit only at the top edge (>=0x0f)
9faf	side set: read the segment
9fb2	flip only when the segment is 0
9fb4	reload state to flip the turn-side bit
9fb7	toggle bit6
9fb9	store it back
9fbc	set the object-script cursor to 0x66
9fbe	store the script cursor
9fc1	continue into the segment step
9fc4	raise the script-branch flag
9fc6	store 1 into the script-branch flag
9fc9	index by this enemy's segment/column
9fcc	read the column's shallowest-depth record
9fcf	skip seeding if it already holds a value
9fd1	seed an empty column with 0xf1
9fd3	store it
9fd6	read this enemy's depth
9fd9	compare with the column's recorded minimum
9fdc	skip if not a new shallowest
9fde	record the new column minimum
9fe1	tag the column as flagged
9fe3	store the lane-target flag
9fe6	read the depth again
9fe9	is it too shallow (below 0x20)
9feb	branch if deep enough
9fed	too shallow: read the direction byte
9ff0	set the climb-direction bit -- turn it around
9ff2	store it back
9ff5	clamp depth to 0x20
9ff7	store the clamped depth
9ffd	past the far limit (>=0xf2)
9fff	branch out if still within the tube
a001	aim the enemy at the deepest column
a004	repark depth at the far wall 0xf0
a006	store it
a009	read the fire gate
a00c	skip the rewrite while the gate is open
a00e	rewrite the direction byte
a011	clear its low 2 bits
a013	set kind to 1
a015	store it back
a018	rewrite the enemy state byte
a01b	clear the low 3 bits
a01d	set segment kind to 2
a01f	store it back
a024	clear the script-branch flag
a02a	clear the running-max holder
a02e	set the 16-column scan countdown
a031	draw a secondary-RNG start
a034	reduce to a column index 0..15
a037	is this the last column
a039	skip the last-column special case
a03b	read the live-board flag
a03e	skip the last column while the board is live
a040	read the column's recorded depth
a043	an empty column...
a045	...counts as maximal depth 0xff
a047	compare against the running max
a049	keep the previous max if not deeper
a04b	record the new max depth
a04d	record its column
a04f	step to the previous column
a050	wrap...
a052	...back to column 15
a054	decrement the scan countdown
a057	loop over all 16 columns
a059	take the winning column
a05b	set the enemy's target segment
a05f	successor column = winner + 1
a061	wrap mod 16
a063	store the successor heading
a066	read the direction byte
a069	clear the climb-direction bit -- aim inward
a06b	store it back
a06f	read the retiring enemy's depth
a072	stash it
a074	compare with the player-shot depth
a077	branch to the total-count path unless at that depth
a079	read the enemy state byte
a07c	isolate the segment kind
a07e	is it segment kind 4
a080	if so, drop the total count instead
a082	drop the per-type live-enemy count
a088	drop the total live-enemy count
a08d	clear the slot depth -- retire it
a090	read the state byte
a093	isolate the segment kind
a095	save the caller's slot index
a098	drop that column's active-enemy counter
a09b	restore the slot index
a09d	read the direction byte
a0a0	isolate the replacement-gate bits
a0a2	no split when the gate is 0
a0a5	decode the split count
a0a7	is it 2
a0ab	remap 2 to 4
a0ad	seat the split draw cell
a0af	read the enemy's segment
a0b3	step it back one
a0b5	wrap mod 16
a0b7	did it wrap to 0x0f
a0b9	skip the wrap fix-up if not
a0bb	test the live-board flag bit7
a0be	skip unless the wrap bit governs
a0c0	clamp the segment to 0
a0c2	seat the split lane cell
a0c4	build the coordinate list for the replacement
a0c7	take the list-high byte
a0c9	seed the object-script cursor
a0cc	step it back one
a0d1	clear the script sub-cursor
a0d4	spawn the replacement climber in a free slot
a0d7	done if no free slot took it
a0d9	took: read the split lane
a0dc	offset the mirror lane by 2
a0de	wrap mod 16
a0e0	did it land on 0x0f
a0e2	skip the fix-up if not
a0e4	test the live-board bit7
a0e7	skip unless it governs
a0e9	clamp the mirror lane to 0x0e
a0eb	seat the mirror lane
a0ef	tag the mirror as the second of the pair
a0f1	store it
a0f3	spawn the mirrored second climber
a18f	start at shot slot 0x0b
a191	seat the slot loop index
a193	reload the slot index (loop head)
a195	read the shot slot's counter/state
a198	skip an empty slot
a19a	slots 8 and above...
a19c	...take the velocity-integration path
a19e	near slot: step the counter by 0x09
a1a0	read the slot's hit tally/flag
a1a3	if it is flagged...
a1a6	...take 4 back off the step
a1a8	store the stepped counter
a1ab	advance the shot and score a lane hit
a1ae	reread the counter
a1b1	past the far limit (>=0xf0)
a1b3	branch if still in the tube
a1b5	drop the active-object count
a1ba	clear the slot
a1c0	far slot: read the velocity accumulator low
a1c4	add the per-frame velocity low
a1c7	store it
a1ca	read the position high byte
a1cd	add the velocity high with carry
a1d0	compare against the shot-depth floor
a1d3	keep it if still at or above the floor
a1d5	else drop the live-climber count
a1d7	finalize the top object on a target match
a1dc	clear the slot
a1df	step to the previous slot
a1e1	loop over all shot slots
a1e4	read the player rim segment
a1e7	compare with the slot's target segment
a1ea	bail unless they match
a1ec	read the player fine-angle/ready cell
a1ef	bail if the ready bit (bit7) is set
a1f1	prime the top-priority object
a1f6	latch the ready flag 0x81
a1fa	index by the shot's target segment
a1fd	read that lane's target depth
a200	nothing to hit if the lane depth is 0
a202	read the shot's counter
a205	compare with the lane target depth
a208	not yet reached -> check the tally
a20a	reached: past the far limit
a20c	branch if within the tube
a20e	else zero the value to store
a210	shrink or clear the lane target depth
a213	bump the shot's hit tally
a218	flag the hit lane (0xc0)
a21b	request the segment-hit sound
a21e	seat the award parameters
a22a	add the BCD score and award at the threshold
a22d	restore the shot slot index
a22f	read the hit tally
a232	a second hit
a234	not yet -> keep the shot live
a238	spend the shot -- clear it
a23b	drop the active-object count
a23f	read the player fine-angle/ready cell
a242	bail while its bit7 is set
a244	read the game status byte
a246	take the fire-button path during active play
a248	read the moving-spike active flag
a24b	seed the gate accumulator with it
a24d	scan slots 0x0a..0
a24f	read the slot's live byte (loop head)
a252	skip an empty slot
a254	read the slot's segment
a258	distance from the player segment
a25b	take the absolute value...
a260	...negate if below
a262	within 1 segment of the player
a264	skip if farther
a266	count this near slot into the gate
a269	loop over the slots
a26b	take the gate value
a270	fire-button path: read the debounced input
a272	isolate the fire button bit
a274	bail if the gate is 0 / button not held
a276	scan slots 7..0 for a free one
a278	read the slot state (loop head)
a27b	skip an occupied slot
a27d	take it: bump the active-object count
a280	seed the slot depth from the player-shot depth
a286	seed the target segment from the player segment
a28c	seed the fine angle from the player fine-angle
a294	clear the slot's hit tally
a297	request the enemy-spawn sound
a29a	read the player-shot depth
a29d	resolve interactions with nearby slots
a2a3	loop -- and exit after a take
a2a6	read the player rotation / object-pending flag
a2a9	skip the whole hatch pass while the pending flag (bit7) is set
a2ab	index the top source enemy slot (6..0)
a2ad	read the source slot's tube depth
a2b0	skip an empty slot
a2b4	skip unless the source sits deep enough down the tube to hatch
a2b6	read the slot's direction/state byte
a2bb	skip unless the slot is an armed source (bit6)
a2bd	tick the source's emit timer down
a2c0	fire only on the tick the timer underflows
a2c2	restore the underflow tick to the timer
a2c5	read the slot flags
a2ca	skip a slot flagged done (bit7)
a2cc	read the RNG
a2cf	index the per-wave spawn-rate gate by the live-enemy count
a2d1	gate the hatch against the per-wave spawn-rate table
a2d4	a low roll blocks the hatch -- denser waves emit less often
a2d6	start the free flyer-slot scan at the difficulty-clamped top index
a2d9	read a candidate flyer destination slot
a2dc	skip an occupied destination slot
a2de	read the source depth
a2e1	seed the new flyer's depth from the source
a2e4	read the source segment
a2e7	copy the source segment into the flyer
a2ea	read the source phase
a2ed	copy the source phase into the flyer
a2f0	load the source timer reload period
a2f3	reload the source's emit timer
a2f6	cue the hatch sound
a2f9	count the new enemy
a2fb	end the free-slot scan once the flyer is seated
a2fe	step to the next destination slot
a300	next source slot
a301	loop back over the source slots
a309	stash the slot index for the insert/retire chain
a30d	mark enemy slot X live
a312	convert the 4-based slot handle to a 0-based lane index
a315	read the lane's geometry byte
a318	latch the lane geometry for the object inserter
a31a	draw a random variant seed
a31f	keep the variant only in 0..2
a321	values 0..2 pass through
a323	fold a 3..7 variant to 0
a327	depth class = variant + 2
a329	place the object at the variant's depth class
a32c	fold the prior lane occupant and spawn any split
a331	score tier = variant + 5
a334	award the variant's score tier and grant a bonus life at the threshold
a337	restore the slot index
a33a	spawn a fixed type-5 object
a33c	seat it through the shared insert-and-signal-ready tail
a33f	draw the pending-spawn counter down by one
a343	preset the head-flag tag to 0x09
a347	alternate entry: preset the head-flag tag to 0x07
a34b	top-priority head flag 0xff
a34d	stamp the object's head / animation-phase flag
a350	object type 1
a352	seat the object type byte
a354	read the current shot depth
a357	source = current shot depth
a359	read the player segment
a35c	target = player segment
a35e	fire the spawn sound
a361	seat the object in the eight-slot table
a366	raise the spawn-ready flag (bit7 pending)
a36b	arm the object's animation timer
a36f	cue the destruction sound
a372	read the object's depth
a375	stage the object's depth as the retract source
a377	read the object's segment
a37a	stage the object's segment
a37e	retract the object's draw record (type 0)
a383	empty the slot
a386	one fewer live enemy
a38a	flag lane X spent for the caller's teardown
a38e	raise slot X's active flag
a395	step the lane index back by four -- the slot recycled this pass
a398	read the slot descriptor
a39f	both top bits set marks the split/offset case
a3a1	take the seated segment as-is
a3a7	read the seated segment
a3ab	split case: step the segment back one
a3ad	wrap it within the low nibble
a3af	seed the list-anchor segment
a3b3	insert the replacement object from the slot's depth
a3b6	retire the enemy and spawn any split
a3b9	re-read the descriptor -- the spawn may have reused the slot
a3bc	lane = descriptor low 3 bits
a3bf	look up the lane's score selector
a3c2	award the kill score for that lane
a3cb	cue the spawn sound
a3ce	read slot Y's depth
a3d1	seed the new object's depth from the slot
a3d4	seat the caller's object type
a3e0	scan the eight object slots for a home, high index first
a3e2	read the slot's presence byte
a3e5	an empty slot wins outright
a3e7	read the slot's age counter
a3ee	remember the oldest slot so far as the eviction candidate
a3f3	loop over the slots
a3f5	pool full: evict the oldest, balancing the bump below
a3f8	reuse the oldest slot
a3fc	reset the chosen slot's age -- a fresh object
a401	write the object type
a406	write the object's presence / depth
a40b	write the object's lane coordinate
a40e	one more live object
a416	read the pending-animation flag
a419	skip when nothing is animating
a41d	clear the count -- rebuilt below as the live-slot tally
a420	walk the eight object slots
a422	read the slot's presence byte
a425	skip an empty slot
a427	read the animation counter
a42a	index the per-type tables by the object's type
a42e	advance the counter by the object's per-type step
a434	compare against the object's per-type animation limit
a437	still below the limit -- keep animating
a43b	reached the limit -- free the slot
a441	count this slot as still animating
a445	loop over the slots
a454	walk the eight active object slots, high index first
a456	read the slot's state byte
a459	skip a dead slot
a45b	resolve this slot's proximity interactions -- state byte is the depth threshold
a45f	loop over the slots
a463	park the query depth for the scan
a465	scan all eleven enemy slots (10..0)
a467	read the enemy slot's depth
a46a	skip an empty enemy slot
a470	form the absolute depth distance between the object and the enemy
a47d	slots 0..3 are near the rim; 4..10 are far
a47f	near the rim: require the enemy within the kill distance
a486	and require a matching segment
a48b	retire the object -- a near, same-segment kill
a492	record the scan cursor
a494	read the object's band attribute
a497	fold it to a 3-bit distance band
a49b	test the distance against the per-band threshold
a49e	skip when the enemy is beyond the band's reach
a4a2	band 4 has its own spawn/award handler
a4a9	band 4: skip when the enemy is at the shot depth
a4b1	require a matching segment
a4b9	require the enemy's armed bit set
a4bb	spawn a fresh lane enemy and award the points
a4c3	branch on the enemy's armed bit
a4cb	armed: match the enemy segment against the slot's alternate target
a4ce	on a match, re-activate the slot
a4d5	unarmed and at the shot depth -> skip
a4dd	otherwise require a matching target segment
a4e2	stash the slot index
a4e4	re-activate the slot and respawn
a4ee	continue the enemy-slot scan
a4f1	after the scan, check the slot's spent sentinel
a4fa	spent slot: clear its state
a4fd	drop the live object count
a500	clear the spent sentinel
a504	read the per-frame control byte -- its sign selects which bookkeeping job runs
a507	positive: branch to the wave-setup arm
a509	gather the live-object counts
a50e	fold in the timed-object count
a511	bail while any object is still live
a513	start at the top shot slot
a516	read this shot's depth down the tube
a519	skip an empty slot
a51c	age the shot by a fixed step
a520	clamp against the far rim
a524	snap to zero at the far rim
a526	store the aged depth
a52a	next shot slot
a52c	index the current slot
a52e	read this slot's countdown
a530	branch on whether the countdown is at its last tick
a536	clear a wave flag
a53b	arm the redraw
a53e	step the between-wave clock low byte down by 0x20
a543	store the clock low byte
a545	borrow into the clock high byte
a549	store the clock high byte
a54b	proceed when the clock reaches its marker
a554	step the shot-depth counter by a fixed amount
a55a	store the stepped shot depth
a55f	proceed once it passes the far rim
a561	not yet -- exit
a563	hand off: set the game mode to 6
a567	clear all active shots
a56a	sum the enemy-total and enemy-type budgets
a572	add in the running fire budget
a575	clamp the enemy budget to 0x3f
a57b	store the clamped fire budget
a581	test the wave-setup gate cell pair
a587	skip the timer bump unless a gate is live
a58b	only bump past the threshold
a58f	index the per-slot setup timer
a591	bump the per-slot setup timer
a593	read the spike-active flag
a596	bail while a spike is active
a598	combine the fire budget and timed-object count
a59e	only recycle the wave when both are clear
a5a0	scan the shot table from the top slot
a5a3	read this shot's depth
a5a8	abort the reset if any shot has grown past 0x11
a5ad	keep scanning
a5af	re-seed the wave state
a5b2	clear active shots
a5b5	gate the second wave reset on a start input
a5bb	gate on the attract/status flag
a5bf	gate on a dip-switch setting
a5c7	re-seed the wave state
a5cb	set the game mode to the wave-start value
a5cf	arm the spike-active bit
a5d4	store the spike-active flag
a5d9	clear the spike step-low byte
a5dc	clear the spike height-low byte
a5df	clear the depth accumulator
a5e1	clear the spiked-lane tally
a5e6	set the spike step-high byte
a5e9	scan the sixteen lane-limit cells
a5eb	read this lane's limit
a5f0	count each spiked lane
a5f6	skip the intro if no lane is spiked
a5fb	only run the intro on early waves -- level below 7
a601	arm the intro delay timer
a605	set the game mode to the spike-intro value
a609	queue the pending mode
a60f	stamp the spike-intro marker into the tally
a612	arm the block-ready latch
a618	seed the frame-active flag from the spawn budget
a61e	walk the sixteen enemy slots top-down
a624	read this slot's flags
a627	branch on whether the slot holds a live enemy
a629	free slot: spawn only while the spawn budget remains
a62e	spawn a new enemy in this slot
a634	advance the live enemy's free flight
a637	decay its velocity
a63c	mark the frame active
a63f	next slot
a643	tick the spawn budget only on even frames
a64e	count the spawn budget down
a651	test whether anything was live or spawned
a654	something happened -- exit
a656	nothing left: raise the mode request to 0x12
a661	center axis-1 position and mark the slot live
a666	mark the slot occupied
a669	center the third axis position
a66c	seed axis-1 velocity low from a random source
a66f	store axis-1 velocity low
a672	draw a signed velocity nudge
a675	store axis-1 velocity nudge
a678	seed axis-0 velocity low from a random source
a67b	store axis-0 velocity low
a67e	draw a nudge for the middle axis
a681	force the middle nudge non-positive
a688	store axis-0 velocity nudge
a68b	seed axis-2 velocity low from a random source
a68e	store axis-2 velocity low
a691	draw a nudge for axis 2
a694	store axis-2 velocity nudge
a697	cue the spawn sound for this slot
a69b	shift the caller's low bit into carry to pick the sign
a69c	take a 3-bit random magnitude, 0..7
a6a1	keep it positive when the selector bit was clear
a6a3	two's-complement negate for a negative step
a6a9	axis 0: fold velocity-low into the fraction
a6b0	store the axis-0 fraction
a6b3	branch on the axis-0 velocity sign
a6b8	rising axis: add the whole, overflow at the far rim
a6bf	off the ring -> zero
a6c4	falling axis: add the whole, overflow below the near rim
a6cb	off the ring -> zero
a6cd	hold the axis-0 whole
a6ce	axis 1: fold velocity-low into the fraction
a6d5	store the axis-1 fraction
a6d8	branch on the axis-1 velocity sign
a6dd	rising axis: add the whole, overflow at the far rim
a6e4	overflow retires the slot -- zero the shared whole
a6e9	falling axis: add the whole, overflow below the near rim
a6f0	overflow retires the slot
a6f2	commit the axis-1 whole position
a6f5	axis 2: fold velocity-low into the fraction
a6fc	store the axis-2 fraction
a6ff	branch on the axis-2 velocity sign
a704	rising axis: add the whole, overflow at the far rim
a70b	overflow retires the slot
a710	falling axis: add the whole, overflow below the near rim
a717	overflow retires the slot
a719	commit the axis-2 whole position
a71d	stamp the axis-0 whole into the shared slot cell -- zero here retires the slot
a721	seed the saturation counter
a725	axis 1: read the velocity pair
a72b	step it one increment toward zero
a72e	store the stepped axis-1 low byte
a732	store the stepped axis-1 whole byte
a735	axis 0: read the velocity pair
a73b	step it toward zero
a73e	store the stepped axis-0 low byte
a742	store the stepped axis-0 whole byte
a745	axis 2: read the velocity pair
a74b	step it toward zero
a74e	store the stepped axis-2 low byte
a752	store the stepped axis-2 whole byte
a755	only when every axis reached rest
a759	retire the slot -- clear its coordinate
a75d	snapshot the incoming whole byte
a75f	branch on the velocity sign
a763	non-negative: subtract the fixed decay step
a767	store the stepped low byte
a769	borrow from the whole byte
a76d	below zero -> zero crossing
a772	negative: add the fixed decay step
a776	store the stepped low byte
a778	carry into the whole byte
a77c	past the ceiling -> zero crossing
a77e	count this axis as saturated
a780	snap the velocity to zero
a789	start at the top of the per-slot flags table
a78d	clear this slot's flags
a790	next slot
a793	reset the spawn budget
a798	reset the spawn-found flag
a79d	reset the mode selector
a79f	clear the projection X offset low
a7a3	clear the projection X offset high
a7a6	stash the target segment
a7a9	compute the signed segment distance
a7ab	store the raw difference
a7ad	test the tube-geometry flag
a7b0	open tube -> keep the full signed byte
a7b2	closed tube -> take the low nibble
a7b4	test the nibble sign bit
a7b9	sign-extend the nibble into a signed byte
a7bd	walk the eight-lane spike table
a7c1	clear this lane's spike height
a7c4	next lane
a7c7	stamp the final slot with the sentinel guard
a7cc	arm the remap-reference guard
a7d2	no-op while the collapse object is disarmed
a7d9	clear the remaining-height accumulator
a7db	walk the eight height slots top-down
a7e1	read this lane's spike height
a7e4	handle an empty slot separately
a7e7	shrink a spike by a fixed step
a7ed	tall enough -> keep the shrunk height
a7ef	short spike: pick a rail from the guard sign
a7f4	negative guard -> high rail
a7f9	non-negative guard -> low rail
a7fe	empty slot stays empty unless the guard is negative
a805	index the wrap-around next neighbour
a80b	wrap the top slot back to slot 0
a80e	read the neighbour's height
a811	no neighbour to borrow from
a813	neighbour too tall to borrow
a817	adopt the high rail from the neighbour
a81e	store the new spike height
a821	fold into the remaining-height accumulator
a827	next slot
a82b	leave the object armed while any height remains
a82d	table fully collapsed -> disarm the object
a831	reset the sweep/stage cell
a836	disarm the block-ready latch
a83a	run only while attract mode is active
a83e	phase already running -> advance it
a843	idle: arm the next stage only when the control byte is positive
a848	and a trigger edge is present
a84e	up to three stages
a855	bump the sweep stage
a858	seed the phase latch
a85d	consume the trigger edge
a866	tick the running phase
a869	the stage indexes the timer-limit table
a86f	phase reached its limit?
a874	phase done -> reset the latch
a879	run the lane-respawn sweep
a87c	always clear the input-edge bit7 on the way out
a888	only sweep once the phase reaches 3
a88f	and only on even phases
a893	scan the slots from the top
a896	first occupied lane is the hit
a89b	keep scanning
a89e	nothing occupied -> mark the phase done
a8a4	clear the found slot's low two direction bits
a8a9	store back the masked direction
a8ac	respawn the enemy and award its points
a8b4	seed the last-stat cell
a8b8	lead the list with the blank/tag-70 word
a8bd	refresh the colour-stat header
a8c0	skip the live-glyph block in attract mode
a8c6	pick the marker shape from the frame phase
a8ca	frame bit set -> first marker shape
a8d0	idle phase -> alternate marker shape
a8d2	or the phase sign flag -> alternate marker shape
a8d8	draw the chosen marker slot shape
a8db	emit the fixed vector word
a8de	read the glyph snapshot
a8e1	mirror it into the first snapshot cell
a8e4	and the second snapshot cell
a8e7	draw the recurring base overlay
a8ee	emit the first marker row
a8f1	attract mode -> gate the second row on the active-slot count
a8f5	else gate on the score/status flags
a8fe	attract: the active-slot count
a900	no gate -> skip the second row
a905	emit the second marker row
a908	mode 4 skips the text and self-check rebuild
a90e	aim the work pointer at the glyph source
a916	load the glyph-buffer offset
a919	build the digit/glyph text buffer
a91e	seed the self-check fold
a920	XOR-fold the self-check byte table
a926	publish the self-check byte
a929	load the mirror destination offset
a92c	three doubled glyph entries
a932	index the glyph through the source table
a935	double the index
a937	read the glyph word
a93a	copy it into the strided mirror
a93f	next entry
a947	post the framing coordinate word
a94a	spiked-segment marker only when its high bit is set
a951	draw the spike marker slot
a956	tail decorations only in mode 0x18
a95c	and only with the status flag set
a960	draw only when the current slot is live
a967	draw the labelled slot record
a96f	emit its numeric value run
a974	draw a trailing marker slot
a979	draw a trailing marker slot
a983	stash the row index in scratch
a985	is this row the currently selected marker
a987	skip the head-blank unless this is the marker row
a989	test the marker-active flag
a98b	skip unless the marker-active bit is set
a98d	blank the row head so the highlight can overdraw it
a98f	or in the 0x70 vector tag for the head word
a991	head-word offset for this row
a994	write the head word into the glyph buffer
a997	glyph-slot offset for this row
a99a	the row's filled-tick count
a99d	seed the count cursor
a99f	skip the dock when the count is zero
a9a1	is this the selected marker row
a9a3	skip unless the marker row
a9a5	the selected row shows one fewer filled tick
a9a7	start at glyph slot 1
a9a9	filled-tick glyph
a9ac	slot index vs the tick count
a9ae	slots up to the count get the filled glyph
a9b0	the slot at the count gets the filled glyph too
a9b2	past the count -- the empty-tick glyph
a9b5	write the glyph into the buffer
a9b8	advance two bytes -- one glyph plus its tag
a9ba	next slot
a9bb	seven glyph slots per row
a9bd	loop the seven slots
a9bf	restore the row index
a9c1	read the game mode
a9c3	mode 4
a9c5	otherwise go on to emit the number
a9c7	is this the marker row
a9c9	in mode 4, skip the number on non-marker rows
a9cb	buffer cursor for this row's digit string
a9ce	low byte of the digit-source pointer
a9d1	seat the source pointer low
a9d5	source high byte 0 -- the digits live in zero page
a9d7	three digit passes -- two down to zero
a9d9	seat the pass counter
a9db	set the leading-zero suppress flag
a9dc	carry the suppress flag across the high-nibble emit
a9df	read the packed-BCD source byte
a9e1	shift the high nibble down
a9e5	restore the suppress carry
a9e6	emit the high-nibble digit glyph
a9e9	the pass counter
a9eb	on the final pass only
a9ed	clear suppress so the units digit always prints
a9f0	reread the byte for its low nibble
a9f2	emit the low-nibble digit glyph
a9f5	walk the source pointer back one byte
a9f7	count down the passes
a9f9	loop until the pass counter underflows
a9fc	take the low nibble -- the digit value
a9ff	is the nibble zero
aa01	a nonzero digit clears the leading-zero suppress
aa02	a suppressed leading zero selects the blank glyph
aa04	otherwise index the digit's own glyph
aa07	double the index -- two bytes per glyph entry
aa09	fetch the digit's stroke byte from the glyph table
aa0c	store it into the text buffer at the cursor
aa0f	advance the cursor
aa10	past this two-byte glyph
aa13	default template index -- the active slot count
aa15	test the status flag bit7
aa17	bit7 set -- keep the default template
aa19	combine the loc_43/44/45 trio
aa1b	fold in loc_44
aa1d	fold in loc_45
aa1f	all zero -- keep the default template
aa21	any of the trio set -- force template index 1
aa23	write cursor low byte
aa25	seat the cursor low
aa27	write cursor high byte
aa29	seat the cursor high -- text buffer at 0x2f60
aa2b	template byte length from the length table
aa30	length plus cursor low
aa32	save the post-copy cursor low
aa33	copy a stroke byte from the template block
aa36	into the text buffer
aa38	step down the copy counter
aa39	copy the template down toward index 0
aa3b	final stroke byte at index 0
aa3e	store it
aa40	read the status flags
aa42	bit7 clear -- skip the live count
aa46	repoint the cursor high
aa4a	and low -- to the count field at 0x2fa6
aa4c	the count source
aa4f	plus one
aa51	render it as BCD digits
aa54	restore the saved cursor low
aa55	seat it back
aa57	tail into the record-close emitter
aa5a	lead this frame with draw slot 0x08
aa5c	draw that slot's shape record
aa5f	chain into the shared count-prep and frame composer
aa62	header/colour seed 0x30
aa64	lead with slot 0x00 -- the player/overlay slot
aa66	draw that slot's record with the given header
aa69	count prep -- draw slot 0x02 and lay the digit run
aa6c	hand to the per-frame composition driver
aa6f	build the alternate text-overlay display list
aa72	header seed 0x00
aa74	slot 0x06
aa76	append slot 0x06's shape record
aa79	header seed 0x00
aa7b	lead with slot 0x32
aa7d	draw that slot's shape record
aa80	read the frame counter
aa82	low bits of the 32-frame cycle
aa84	in the first sixteen frames
aa86	skip the blink slot in the second half
aa88	header seed 0xe0
aa8a	slot 0x22
aa8c	draw it only in the first half -- a 50%-duty blink
aa8f	finish through the text-overlay builder
aa92	the fixed slot 0x02
aa94	draw its shape record
aa97	baseline scale value 0
aa99	set the vector scale to baseline, emit only if it changed
aa9c	the slot index named by loc_3d
aa9e	advance the slot index by one
aa9f	publish it into the byte the digit emitter reads
aaa1	source pointer 0x61
aaa3	one byte long
aaa5	emit it as a single digit glyph
aaa8	the config-switch snapshot
aaaa	its low two bits
aaad	pick a shape id from the slot table
aab1	draw the config-selected slot
aab4	tick down the display countdown timer
aab7	the second config snapshot
aab9	bit 0
aabb	clear -- spend the slot on the checksum instead
aabd	the frame counter
aabf	phase-gate bit
aac1	gate high -- take the checksum path
aac3	alternate slot 0x32
aac5	draw it
aac9	skip the checksum this frame
aacb	recompute the display-list checksum
aace	fixed marker slot 0x2c
aad0	draw it
aad3	fixed marker slot 0x2e
aad5	draw it
aad8	the level/phase index
aada	against its ceiling 0x28
aadc	below -- keep it
aade	clamp to 0x28
aae0	store the clamp
aae2	draw the phase index as BCD digits
aae5	the heartbeat accumulator high byte
aae7	skip the trailing word while it is zero
aae9	trailing coordinate word, low byte
aaec	and high byte
aaef	post it into the display list
aaf5	switch the CPU to decimal mode for the conversion
aaf6	the binary byte to convert
aafa	clear the BCD accumulator
aafc	eight double-dabble passes
aafe	shift the top bit out of the source byte
ab00	load the accumulator
ab02	double it in decimal, folding in that bit
ab04	back to the accumulator
ab07	repeat for all eight bits
ab09	back to binary mode
ab0a	publish the packed-BCD result
ab0d	constant vector word, low byte
ab0f	high byte
ab11	emit it through the draw cursor
ab14	fetch the slot's colour/header seed from the ROM table
ab17	remember the slot index
ab19	the caller's colour/header seed
ab1d	shape-list pointer low from the per-slot table
ab1f	seat the pointer low
ab22	and the high byte
ab24	seat the pointer high
ab26	is this the marker slot 0x2c
ab28	if not, skip the snapshot
ab2a	snapshot the draw cursor low so a later pass can find this record
ab2c	store it
ab2e	and the cursor high
ab30	store it
ab34	the record's first byte -- its position
ab36	seat the position
ab38	emit the fixed framing word
ab3d	clear the vector-record header cell
ab41	seed the last-status latch = 1
ab43	emit the blank/intensity vector header word
ab4a	emit the scaled beam move to the shape's position
ab4d	load this shape's slot index
ab4f	read the shape's coordinate-list pointer low from the slot table
ab54	read the pointer high from the next table byte
ab5a	read this shape's packed colour/scale key
ab63	set the beam colour from the key's high nibble
ab69	set the draw scale from the key's low nibble
ab70	reset the output offset
ab72	read the next point entry from the shape list
ab76	low 7 bits index the point-coordinate table
ab7c	fetch the point's low byte from the coordinate table
ab81	write the point low byte into the display buffer
ab84	fetch the point's high byte
ab87	write the point high byte into the display buffer
ab8e	test the entry's terminator bit
ab90	loop until an entry's high bit ends the shape list
ab95	close the record, advancing the cursor past the points
ab98	set which shape slot to draw
ab9a	set the draw position seed
ab9e	clear the colour/flag header
aba0	fall into the shared shape-list emitter
aba2	refresh the option-switch snapshot -- may request a rebuild
aba5	read the pending-work flags
aba8	test the two rebuild-request bits
abaa	no rebuild requested -- take the do-nothing tail
abac	refresh the option-switch snapshot -- may request a rebuild
abb1	stamp the block-system state marker
abb4	gather the three activity sources
abbd	skip the force when any source is active
abbf	fully idle machine -- force both rebuild requests on
abc2	wider copy run when the copy bit is armed
abc4	test the copy-block request bit
abcb	narrower copy run otherwise
abcd	read a template control-block byte
abd0	write it into the live control block
abd4	loop over the block
abd8	test the glyph-fill request bit
abe3	fill the glyph-parameter block with ones
abe7	loop over the block
abe9	test whether any request bit is set
abee	no rebuild happened -- skip the snapshot latch
abf4	latch the option-switch snapshot (high bits)
abfc	latch the difficulty snapshot (low bits)
ac04	clear the two rebuild-request bits, keep the rest
ac20	re-read and decode the operator option switches
ac25	mask the option-switch high bits
ac27	compare against the cached snapshot
ac2a	differ -- request a rebuild
ac31	compare difficulty against the cached snapshot
ac34	switches unchanged -- take the no-op tail
ac39	arm both rebuild-request bits
ac3b	store the armed request flags
ac43	clear the request-in-progress flag
ac49	option-switch test gating the staging wipe
ac4d	wipe the sound staging block
ac50	fold in the periodic high-score save
ac55	zero the running total
ac58	pick the starting channel from the active-slot count
ac5e	seat this channel's sort-key triple from its base cells
ac6d	remember the channel parity across the sort
ac73	seed the swap-temp triple
ac7b	clear this channel's pass counter
ac7e	start the row cursor at the top
ac83	compare this row's key high against the running key
ac8a	compare the key middle byte
ac95	compare the key low byte
ac9b	rows already ordered -- skip the swap
ac9f	below the high region -- skip the payload swap
aca6	swap the parallel payload triple alongside the key
acc4	swap this row's key with the running key
acdc	swap the key's low byte too
ace8	keep bubbling the swap down the table
acec	count a settle pass
acf6	advance to the next row pair
acfd	record this channel's pass count
ad01	both channels done -- exit the sort loop
ad12	nudge the running total up by one
ad1f	pack the sound-request byte and store it
ad27	no pending sound request -- drop to idle
ad2b	take the low two bits as the slot index
ad2f	consume those two bits from the request word
ad37	read this slot's metric
ad3a	skip empty or out-of-range slots
ad4a	form the slot's control value (scale by three, invert, offset)
ad4d	select the projection scale
ad52	seed the slow pass counter
ad57	clear the input-edge flags
ad59	clear the spinner accumulator
ad5d	seed the re-arm counter
ad60	reset the per-slot state table
ad65	set the sound state to armed
ad68	walk on to the next requested slot
ad6b	set the sound state to idle
ad70	select this mode's dispatch code
ad76	run the slow tick only every 32nd frame
ad78	count down the slow pass counter
ad7f	pass counter expired -- leave this mode
ad85	load the active slot's ramp value
ad88	fold the spinner step into the value
ad8e	rail a negative value to 0x1a
ad97	rail an over-range value to 0x00
ad9c	store the clamped ramp value back
ada1	read the input-edge gate (bits 3-4)
ada8	consume the edge bits
adab	no edge -- done
adad	step the slot cursor down
adb0	count down the re-arm counter
adba	metric gate for the low-region write
adbe	request the low-region write for a low-metric slot
adc1	arm the next requested slot
adca	silence the slot just retired
adcf	read the signed spinner sub-step
add1	scale the sub-step by eight
add7	fold it into the fine rotation fraction
adda	check the sub-step's sign
adde	positive step -- add only the fraction carry
ade3	negative step -- carry one down from the whole byte
ade7	consume the spinner sub-step
adea	build the static text overlay
adf1	draw the framing shape
adf4	tick down the score-display countdown
adf7	draw the countdown digits
adfc	draw a marker shape
ae03	draw a label shape
ae0a	draw a label shape
ae0f	draw a marker shape
ae16	form the highlighted-row selector (control value minus re-arm counter)
ae19	draw the glyph rows, highlighting the selected one
ae1c	build the static text overlay
ae1f	block interrupts around the paired random reads
ae20	sample the first POKEY random register
ae26	seed the scratch random byte
ae2c	fold its high nibble into the scratch byte
ae30	sample the second POKEY random register
ae36	re-enable interrupts
ae3d	fold the second sample's high nibble in
ae46	store the stirred random nibble
ae49	draw the counter pair
ae4c	no row highlighted -- fall into the row list
ae4e	remember which row to highlight
ae52	prime the pen with a fixed shape
ae57	set the row base position
ae59	set the drawing scale
ae5e	seed the column cursor
ae62	set the top row index (steps down by three)
ae64	emit a fixed vector word
ae69	clear the vector-record header
ae71	step the column cursor back one row
ae75	position this row
ae7c	pick the highlight tint when this is the selected row
ae82	set the row colour
ae89	emit a one-digit numeric run
ae8e	emit a blank value record
ae98	position the label
ae9b	advance down a row
ae9f	draw this row's three-character label
aea6	position the numeric run
aeab	seat the row's numeric triple from the per-row tables
aebe	emit the three-value numeric run
aec1	step to the next row up (index minus three)
aec7	loop until the row index wraps below zero
aeca	read the bonus-life interval -- skip the marker when zero
aecf	seat the interval into the flag record
aed3	open the bonus-life flag shape
aed8	clear the flag's coordinate pair
aee0	emit the flag's numeric run
aee6	seed the checksum accumulator
aee8	fold the next source byte into the checksum
aeec	fold all seventeen source bytes
aeee	publish the display-list checksum to the end-of-list gate
aefb	point at the last of the three character codes
af01	set the three-character pass count
af05	read this character's code
af0c	fold an out-of-range code to a blank
af0e	double the code into a glyph-table index
af10	copy the glyph's low byte into the display list
af16	copy the glyph's high byte
af1c	step back to the previous character
af23	advance the display cursor past the string
af26	read the first counter byte of the paired readout panel
af29	or in the second counter byte -- panel is empty only if both are zero
af2c	both counters zero: draw nothing, return through the shared tail
af2e	select the shared header shape record
af30	emit the panel header shape record
af33	header count value -- 99
af35	emit the header count, clamped to 99
af38	slot 0
af3a	draw counter slot 0
af3d	slot 1: fall through into the per-slot worker
af3f	read this slot's counter byte from the counter array
af42	empty slot: draw nothing
af45	stash the slot index in scratch
af47	colour/intensity attribute for the slot
af49	emit the colour stat only if it changed
af4c	emit a fixed vector word
af4f	coordinate scale for the count glyph
af51	reload the slot index
af53	read this slot's Y position from the glyph-coordinate table
af56	emit the scaled coordinate record
af5a	emit the count itself, clamped to 99
af5d	blank spacer value
af5f	emit a blank value spacer record
af66	draw the small count shape list at position
af69	reload the slot index
af6b	emit the trailing slot-index digit
af71	compare the count against the 99 ceiling
af73	already under the ceiling: emit as is
af75	clamp the count to 99
af77	pack the binary value to packed BCD in the scratch cell
af7a	point at the packed-BCD scratch byte
af7c	one byte to walk
af7e	emit that byte's two nibbles as decimal digit glyphs
af81	refresh the projection/scale gates for this frame
af84	tick the score-display timer down
af87	colour attribute for the tube preamble
af89	open the draw stream with a colour stat if it changed
af8e	prime the last-scale latch
af90	emit a blank vector word
af97	draw the header slot shape record
af9a	draw the preamble slot then its digit run
af9d	rim ring: start at the top segment index 7
af9f	seed the rim loop counter
afa1	current rim segment index
afa3	read this rim segment's shape arg from the table
afa6	draw this rim segment shape record
afa9	next rim segment
afab	loop through rim segments 7 down to 0
afad	read the blaster's rim target position
afb1	signed distance from the depth window to the target
afb3	target at or above the window: handle the non-negative case
afb5	target below the window: step the depth-window pair down
afb7	step the window's second byte down as well
afbc	nonzero distance: window still chasing the target
afbe	on target: pull the window in by one
afc0	pull the window's other byte in as well
afc2	skip the undo unless the step underflowed
afc4	undo the pull-in if it dropped below zero
afc6	restore the window's second byte
afcb	load the window far byte
afcd	compare it against the depth ceiling
afd2	past the ceiling: settle without stepping closer
afd5	distance past the target position
afdb	at or beyond the target: settle
afdd	step the window one closer to the target
afdf	step the window's second byte closer as well
afe1	seed the depth cursor from the window far byte
afe3	store the depth-row cursor
afe5	five depth rings, deepest first: index 4
afe9	colour stat for this depth ring
aff0	clear the record header byte
aff2	emit a fixed vector word
aff5	coordinate scale for the ring
aff9	read this ring's tube-well segment coordinate from the table
affd	offset the coordinate back for the ring position
afff	emit the ring's scaled coordinate record
b004	read this ring's depth threshold from the table
b007	compare the threshold against the far edge -- 99
b009	ring already at the far edge: skip its label body
b00b	depth label value: threshold plus one
b00d	draw the depth label as two decimal digits
b010	colour attribute for the label
b012	emit the colour stat if changed
b015	emit a fixed vector word
b018	label scale
b01c	this ring's segment coordinate
b020	offset the coordinate for the label position
b022	emit the label's scaled coordinate record
b025	emit the depth row's table-value digit run
b02a	emit a fixed vector word
b02d	outline scale
b031	this ring's segment coordinate for the outline
b037	emit the outline's scaled coordinate record
b03c	this ring's depth threshold
b03f	draw the tube ring outline
b042	recede one ring deeper
b044	next ring
b046	loop through the five depth rings
b04a	clear the record header for the trailer
b04c	emit a fixed vector word
b04f	draw the framing slot shape record
b058	emit a short nibble digit run
b05b	colour attribute for the blaster
b05d	emit the colour stat if changed
b060	emit a fixed vector word
b065	advance the blaster rim position and clamp it into the tube
b069	index the well coordinate relative to the depth window
b06c	read the well segment coordinate for the blaster position
b070	offset the blaster coordinate
b072	emit the blaster-relative coordinate record
b077	closing frame uses the $e0 record header
b07b	vertex table cursor: start at 0
b07f	four closing frame vertices
b081	current vertex table index
b083	read the vertex x byte from the table
b088	read the paired vertex a byte
b08c	step to the next vertex pair
b08e	emit the closing frame vertex coordinate
b091	next vertex
b093	loop through the four closing vertices
b0ab	read the current blaster rim position
b0ae	fold the pending signed sub-step into the position
b0b2	negative result: stepped below the first lane?
b0b4	floor to lane 0
b0b9	compare against the depth ceiling
b0bc	under the ceiling: keep the position
b0be	clamp to the ceiling
b0c1	write back the new rim position
b0c4	return it in Y as well
b0c7	seat the working pointer from the ROM pointer table at this index
b0ca	point at the three-byte scratch run
b0cc	three bytes to walk
b0ce	emit those three bytes as decimal digit glyphs
b0d1	compare the requested attribute against the latched colour value
b0d3	unchanged: emit nothing
b0d5	latch the new colour/intensity value
b0d9	emit the tagged colour/intensity attribute word
b0dd	compare the requested scale against the last-emitted scale
b0df	unchanged: emit nothing
b0e1	latch the new scale value
b0e3	emit it as a tagged scale word
b0e7	set the game mode to live
b0e9	store the game mode
b0eb	clear the pending mode
b0ef	seed the mode-promotion countdown
b0f5	set the display-mode selector -- pre-doubled table offset
b0f7	far cursor of the animated span
b0f9	store the far cursor
b0fc	near cursor of the animated span
b0fe	store the near cursor
b102	coordinate byte handed to the span emitter -- reused at each step
b104	second coordinate byte handed to the span emitter
b106	redraw the segmented span between the current cursors
b109	load the far cursor
b10e	far cursor at the 0xa0 ceiling: stop growing it
b110	step the far cursor up by 0x14
b112	store the far cursor
b117	hold the near cursor until the far cursor clears 0x50
b11d	step the near cursor up by 0x08
b11f	store the near cursor
b122	near cursor still trailing the far cursor?
b125	still trailing: keep spreading this frame
b127	spread complete: pin the near cursor at the ceiling
b129	store the pinned near cursor
b12e	latch the display-mode selector to advance to the next state
b131	coordinate byte handed to the span emitter -- reused at each step
b133	second coordinate byte handed to the span emitter
b135	redraw the segmented span between the current cursors
b138	load the near cursor
b13d	near cursor below the 0x30 floor: hold it in place
b13f	step the near cursor down by one
b141	store the near cursor
b146	underflowed past zero: pinch done, leave the far cursor
b148	load the far cursor
b14c	step the far cursor down by one
b14e	compare the far cursor against the near cursor
b151	far cursor still above the near cursor: keep it
b153	clamp the far cursor at the near cursor so the pair meets
b156	store the far cursor
b15a	stash the coordinate pair's first byte
b15c	stash the coordinate pair's second byte
b15e	seed the walking cursor at the near bound
b161	store the walking cursor
b163	tick the score-display countdown down
b166	load the walking cursor
b168	shift the cursor low bits into the header payload
b16a	mask to seven bits
b16d	load the walking cursor again
b16f	shift out the cursor high bits for the header Y byte
b174	emit the segment header word
b179	first cursor position?
b17e	first position gets a plain 0 marker
b183	derive the segment number from the cursor
b187	mask to the low three bits
b189	top segment 7?
b18d	fold the top segment down to 3
b192	emit the tick marker tagged 0x68
b199	emit the stashed coordinate pair for this step
b19f	step the cursor two forward
b1a1	store the walking cursor
b1a3	loop while the cursor stays below the far bound
b1ac	draw the span's closing slot shape trailer
b1b3	emit the final trailer coordinate word
b1b6	clear the math-box and frame work cells
b1b9	read the display-list header guard word
b1bc	compare it against its level checkpoint
b1bf	guard differs: rebuild the list
b1c1	read the pending level-layout trigger
b1c4	trigger set: rebuild the list
b1c6	frame already settled: return
b1c7	read the display-mode selector
b1cb	selector zero: route the whole draw through the frame builder
b1cf	seat the draw cursor for the list
b1d2	publish the frame link
b1d5	a change was published: skip the mode dispatch and checksum
b1d7	run the display-mode dispatch trampoline
b1da	score-display timer zero: skip the checksum fold
b1df	walk 40 bytes of the record
b1e1	checksum seed
b1e4	subtract each record byte under the draw pointer, carry-chained
b1e7	fold all 40 bytes
b1ec	whiten the checksum with 0xe5
b1f0	whiten it again with 0x29
b1f2	store the record checksum
b1f7	close the layer pointer
b1fa	latch the play-mode header low byte into the first display word
b1fd	store it into the first display word
b200	latch the play-mode header high byte
b203	store it into the second display word
b209	route the whole frame through the frame builder
b20d	read the pre-doubled display-mode selector
b20f	push the selected handler address high byte from the mode table
b213	push the handler address low byte
b217	jump to the selected display-mode handler
b230	seat the draw cursor for layer 07
b235	draw the score / status text list
b23a	close layer 07
b23f	seat the draw cursor for layer 04
b242	draw the styled slot shape list
b247	close layer 04
b24c	seat the draw cursor for layer 03
b24f	draw the secondary styled slot list
b254	close layer 03
b259	seat the draw cursor for layer 06
b25c	draw the enemy shape list
b261	close layer 06
b266	seat the draw cursor for layer 05
b269	build the general object display list
b26e	close layer 05
b273	seat the draw cursor for the player layer 00
b276	build the text overlay list
b27b	status sign bit set: skip the player-shape checksum
b27d	player-shape checksum seed
b282	add each player-shape byte under the draw pointer, carry-chained
b285	fold all 40 bytes
b287	store the player-shape signature
b28c	close the player layer 00
b28f	draw the tube rim lanes
b294	seat the draw cursor for layer 01
b297	build the enemy display list
b29c	close layer 01
b2a1	seat the draw cursor for layer 08
b2a4	draw the timed-object list
b2a9	close layer 08
b2ae	clear the redraw change-counter
b2b1	latch the per-frame header low byte
b2b4	store it into the first display word
b2b7	latch the per-frame header high byte
b2ba	store it into the second display word
b2bf	double the layer index into a two-byte pointer-table stride
b2c1	read this layer's pointer-parity flag
b2c4	nonzero flag selects pointer table A
b2c6	zero flag: take the pointer low byte from table B
b2c9	and its high byte
b2cf	nonzero flag: take the pointer low byte from table A
b2d2	and its high byte
b2d5	seat the indirect draw cursor low byte
b2d7	seat the draw cursor high byte
b2db	clear the list offset so the walk starts at the head
b2df	double the layer index into a two-byte pointer-table stride
b2e1	read this layer's pointer-parity flag
b2e4	nonzero flag selects pointer table B -- sense reversed from the primary seater
b2e6	zero flag: take the pointer low byte from table A
b2e9	and its high byte
b2ef	nonzero flag: take the pointer low byte from table B
b2f2	and its high byte
b2f5	seat the alternate draw pointer low byte
b2f7	and its high byte
b2fb	clear the list offset so the consumer starts at the head
b2ff	finalize the layer's header record
b304	double the slot into a two-byte table index
b306	read the layer's base pointer low byte
b309	seat the working pointer low byte
b30b	base pointer high byte
b30e	seat working pointer high byte
b310	read this slot's double-buffer parity flag
b313	toggle it
b315	store the toggled parity back
b318	parity set selects the odd draw buffer
b31a	even buffer pointer low byte
b31d	even buffer pointer high byte
b323	odd buffer pointer low byte
b326	odd buffer pointer high byte
b32b	write the selected buffer pointer low byte through the working pointer
b32f	and its high byte
b332	read the live vector-list source header
b335	compare it against the checkpoint copy
b338	unchanged: go emit the frame link
b33a	source moved mid-frame: re-latch the checkpoint
b33d	signal the caller to rebuild the frame
b33f	read the pointer-parity mode flag
b342	nonzero mode picks the 0x08 record slot
b344	otherwise the 0x02 record slot
b349	the 0x08 record slot
b34b	read the selected buffer word's low byte
b350	clear the score-display timer
b353	splice the low byte into the list at the draw cursor
b356	selected buffer word's high byte
b359	splice the high byte
b35b	reload the draw cursor low byte from the second table so the next record chains on
b360	and its high byte
b367	read the redraw counter
b36a	clear: skip the pointer pre-pass
b36e	seat the draw cursor for rim layer 2
b371	init and draw the rim depth counters
b376	close rim layer 2 and flip its buffer
b37b	refresh the alternate draw pointer for layer 2
b382	clear the sixteen-entry lane-flag block
b38b	spike/close-up guard negative: skip the enemy-state merge
b38d	start the enemy-slot sweep at the top slot
b390	read this slot's depth
b393	empty slot: skip
b397	read this slot's state flags
b39a	low three state bits
b39c	on-rim state?
b39e	not drawn on the rim: skip
b3a1	seed the per-lane flag byte at 1
b3a3	re-read the slot state flags
b3a6	test the sign bit
b3a8	sign set: skip the near-lane contribution
b3aa	read the enemy animation accumulator
b3ad	not animating: don't bump the flag
b3af	read this slot's depth
b3b2	compare against the near-rim depth threshold
b3b5	farther than the threshold: don't bump
b3b7	nearer while animating: bump the lane flag so the lane blinks
b3bb	load the per-lane flag byte
b3bd	near lane index
b3c3	OR the flag into the near lane
b3c6	far lane index
b3cb	tag the far lane with bit7
b3d0	OR the tagged flag into the far lane
b3d6	base rim colour
b3d8	read the wave-phase latch
b3e3	every eighth frame while the wave is ready...
b3e7	...use the alternate base colour
b3e9	latch the base colour
b3ef	default the colour-cycle ramp offset to none
b3f1	read the player's shot depth
b3f4	no live shot: no aim highlight
b3f6	read the player's fine aim angle
b3fb	aim column A = the player's segment
b3fe	aim column B = the player's fine angle
b401	cache aim column A
b403	cache aim column B
b405	read the rim colour-cycle phase
b408	phase exhausted: no rotating ramp
b40d	set the ramp offset from the colour-cycle phase
b40f	advance the rim colour cycle
b412	first pass: lanes 15..0
b416	read this lane's flag
b419	unflagged lane: pick an aim or ramp colour
b41b	test the blink bit
b41d	flagged but non-blink: solid colour
b41f	blink with frame parity
b427	compare the lane to aim column A
b42b	compare the lane to aim column B
b42d	not an aim column
b42f	aim column: highlight colour
b434	read the colour-cycle phase
b437	ramp exhausted: use the held base colour
b43b	rotate the ramp by the lane index
b443	wrap the top ramp step to colour 3
b449	held base colour
b44c	look up this lane's slot in the rim list
b44f	write the colour into the rim display list
b456	read the tube-geometry flag
b45b	geometry set: start the second pass one lane lower
b45e	read this lane's flag
b461	bit7 clear keeps the colour bits
b463	bit7 set clears the colour bits
b467	look up this lane's slot in the patch list
b46a	read the current patch-list byte
b46c	keep its low five bits
b46e	fold in the chosen colour bits
b470	write the recoloured byte back to the patch list
b49a	run count for the record header
b49e	emit the leading tagged vector word
b4a3	open the object record header
b4a8	draw budget: at most 18 objects
b4ac	scan object slots from the top down
b4b2	read this slot's object kind
b4b7	empty slot: move to the next
b4ba	high kinds...
b4be	...consume an extra slot
b4c1	low six bits are the shape selector
b4c3	write the shape selector into the display list
b4c6	rotate the kind byte to lift its top bits
b4ce	form the 0x70-tagged header code
b4d1	write the header word
b4d4	look up the object's record index
b4d8	object X low byte
b4dc	subtract the viewpoint X offset
b4e0	emit the projected X low byte
b4e3	object X high byte
b4e6	subtract the viewpoint X offset with borrow
b4ea	vector word high byte is five bits
b4ec	emit the projected X high byte
b4ef	object Y low byte
b4f4	emit the Y low byte
b4f7	object Y high byte
b4fe	emit the Y high byte
b503	three zero separator bytes...
b50b	...ending in the 0xa0 tag
b50e	write the tag byte
b511	negated X low byte -- the beam return stroke to origin
b518	emit it
b51b	negated X high byte with carry
b523	emit it
b526	negated Y low byte
b52d	emit it
b530	negated Y high byte with carry
b538	emit it
b53b	page nearly full?
b540	flush the display page
b545	spend one from the draw budget
b547	budget exhausted: done
b549	step to the next slot down
b54b	scanned past slot 0: done
b554	flush the final partial page
b557	read the rolling display checksum
b55d	on level 10 or higher...
b561	...a nonzero checksum stamps the interrupt heartbeat -- an anti-tamper poke
b567	close the list with a trailing blank tagged word
b56e	three zero fields...
b578	...then the caller's value byte
b57d	advance the draw cursor by four
b583	carry into the cursor high byte
b588	raise the rebuild flag for this frame
b58a	read the marker's depth/gate
b58d	zero: nothing to show
b591	out of the valid depth band: skip
b593	latch the depth
b595	and its mirror
b597	read the marker byte
b59c	skip marker 0x81: draw nothing
b59e	the player's segment is the corner index
b5a1	read the rim rotation offset
b5a7	spread size 1..8 from the rotation offset
b5a9	emit the rim-segment spread from the corner
b5ad	read the spike guard
b5b0	spike/close-up pass suppresses the slot draw
b5b4	walk the seven tube slots 6..0
b5b8	read this slot's enemy control/depth
b5bb	empty slot: skip
b5bd	hand the depth to the draw handler
b5bf	read the paired flags byte
b5c2	style nibble, bits 4..3
b5c7	latch the draw style
b5c9	low three bits, doubled into a shape selector
b5cf	dispatch this slot's draw handler
b5d8	look up the draw handler's address for this style
b5e0	jump into the selected handler
b5ed	three vectors make the rim segment
b5ef	read this slot's flag byte
b5f2	negative slot: compute the point and draw at corner 0
b5f4	the slot's own tube corner
b5f9	pick the shape header for this draw style
b5fc	draw the rim segment from the corner
b602	derive the slot's screen point
b607	emit the rim segment anchored at corner 0
b60f	read the enemy's direction byte
b612	low two bits pick one of four jump-frame shapes
b615	look up the jump-frame shape
b618	the enemy's target segment
b61b	seat the shape and emit its vector record
b622	the lane this enemy occupies
b625	frame counter
b62b	four-phase shape index 0x12..0x18 from the frame counter
b62d	seat the shape and emit its record
b634	stage the projection depth
b638	the slot's segment number
b63b	base X of the segment corner
b640	base Y of the segment corner
b645	animation phase, low nibble
b650	add the per-phase X vertex offset -- signed, excess-128
b657	clamp toward the sign that overflowed
b660	store the finished screen X
b667	add the per-phase Y vertex offset
b66e	clamp on signed overflow
b677	store the finished screen Y
b679	current tube shape
b67c	first draw-style byte for this shape
b681	second draw-style byte
b69b	stage the slot's depth
b6a0	the slot's segment
b6a3	base X of the segment corner
b6a8	base Y of the segment corner
b6ad	read the phase byte
b6b0	not mid-flip: use the segment position directly
b6b4	the next segment, wrapping 0..15
b6bd	delta to the next segment's X
b6bf	scale it by the flip-phase fraction
b6c3	interpolate the X toward the next segment
b6c7	delta to the next segment's Y
b6cd	scale it by the flip-phase fraction
b6d1	interpolate the Y toward the next segment
b6d5	project the point through the math box
b6da	lay the 0x61 header and open the record
b6df	reset the list offset
b6e1	append the normalized mantissa/exponent pair
b6e4	save the appender's exit cursor
b6ec	pick a frame-phased template word
b6ef	template word high byte
b6f2	template word low byte
b6f7	emit the template vector word at the saved offset
b6fa	stash the input value
b6ff	the phase's 3-bit fraction, in eighths
b709	shift out the fraction's low bit
b70b	bit clear: add nothing this round
b70e	bit set: add the input
b710	sign-preserving halve of the accumulator
b71d	read the animation accumulator
b720	negative phase sets the run flag
b724	latch the run flag
b72a	bias the animation accumulator
b72c	high nibble is the phase index
b730	wrap past the five style phases
b737	latch this phase's style byte
b73c	read this slot's flag byte
b73f	negative slot: compute its screen point
b741	the enemy's rim corner
b746	draw the styled segment from the corner
b74c	derive the slot's screen point
b751	emit the styled segment at the point
b75b	walk the twelve tube slots, high-to-low
b75d	seed the slot loop index
b761	read the slot's occupancy/depth byte
b764	empty slot, skip it
b766	seat the object depth
b768	carry the depth to the emitter
b76a	near slots (below 8) vs far slots
b76c	the slot's target tube segment
b76f	far slot: size pulses with the frame phase
b771	near slot: fixed shape size
b776	far slot: read the frame phase counter
b77c	build a pulsing size for distant shapes
b77e	seat the params and emit the shape
b783	loop until the index passes 0
b787	read the current stage
b78c	below stage 6: rim colour 0x04
b792	below stage 8: rim colour 0x0b
b796	latch the per-level rim colour into colour RAM
b79c	clear the draw scratch
b79e	walk the eight shape-bank slots, high-to-low
b7a4	slot's active flag -- also its object depth
b7a7	empty slot, skip
b7a9	seat the object depth
b7ab	slot's tube coordinate
b7b0	slot's shape id
b7b5	shape id other than 1
b7b7	shape 1: the special animated draw path
b7bd	other shapes: the animation byte
b7c1	animation base, forced even
b7c5	shape id below 2 keeps the base
b7c7	shape id 2 or more forces base 0
b7ca	add the per-shape table offset
b7cd	the shape's coordinate
b7cf	seat the params and emit
b7d4	loop until the index passes 0
b7d6	high-level guard
b7d9	guard clear, nothing to latch
b7db	the current level byte
b7df	only levels 0x0d and up are remembered
b7e1	latch the high-level marker
b7eb	the enemy's lane index
b7ed	lane midpoint into the projection point
b7f2	lane midpoint, second axis
b7f7	project the point through the math box
b7fc	lay the record header
b7ff	the animation phase
b802	age the animation sub-timer
b805	sub-timer not expired yet
b807	advance the keyframe phase
b80b	reload the sub-timer from the per-phase duration table
b811	this phase's setup code
b814	0x80 or more: no setup handler
b816	run the phase's setup handler
b81e	form the template index for this phase
b821	fetch the phase's vector-pair word, high
b824	vector-pair word, low
b827	emit the vector word
b84e	push the selected setup routine's address, high
b852	setup routine address, low
b856	jump into the chosen setup routine
b861	colour-RAM triple, entry 2
b864	colour-cycle triple, entry 2
b868	colour-RAM entry 1
b86b	colour-cycle entry 1
b86f	colour-cycle entry 0
b871	colour-RAM entry 0
b875	capture entry 0 as the wrap-around value
b877	walk the triple, top-down
b879	save the current occupant
b87c	drop the carried value into the colour-cycle slot
b87f	mirror it into visible colour RAM
b883	the displaced occupant carries to the next slot
b888	rebuild the packed per-level nibble geometry tables
b88d	seat the vector-list tail cursor low
b892	seat the tail cursor high -- cursor sits at 0x047f
b899	jump target low = the current tail cursor
b89f	tag with the vector-generator jump opcode bits
b8a1	jump target high
b8a6	halt word that ends the beam scan
b8ad	step the cursor down one record
b8b3	borrow into the cursor high byte
b8b6	store the advanced tail cursor low
b8be	emit the opening framing word
b8c3	reset the delta integrators
b8cb	clear the player-shot depth
b8ce	clear the x-offset accumulator
b8d4	depth seed high
b8d8	depth seed low
b8da	pick the base draw-struct pointer pair
b8dd	cache it as the alternate cursor high
b8df	alternate cursor low
b8e1	walk the sixteen object slots, top-down
b8e7	slot activity/flag byte
b8ea	inactive slot, skip
b8ec	the flag doubles as the object depth
b8ee	object position, axis 1
b8f3	object position, axis 2
b8f8	project the tube position to screen
b8fd	clear the record header
b8ff	swap to the alternate cursor for the shadow pass
b902	emit the coord-delta record
b907	emit a blank value record
b90a	swap back to the base cursor
b90f	emit the object-position vector
b912	fetch the constant 2
b915	emit the tag-70 word
b91a	8-phase animation index from the slot
b920	fold phase 7 to 0
b923	store the animation phase
b927	emit the tagged style/phase word
b92c	emit the tag-60 word
b92f	re-cache the pointer pair
b932	lay the next framing word
b937	loop until the slot index passes 0
b939	restore the pointer orientation
b93e	emit the closing blank tag-70 word
b941	emit the C0 record body
b944	exchange the primary and alternate draw cursors
b962	hand back the constant 2 -- the shift loop above always leaves a at 0
b967	read the draw-struct parity flag
b96a	even parity: the clear pointer
b96c	odd parity: the set draw pointer, high
b96f	set draw pointer, low
b975	even parity: the clear draw pointer, high
b978	clear draw pointer, low
bcfd	seat the draw style/colour selector
bcff	segment midpoint into the projection point
bd04	segment midpoint, second axis
bd09	fold the coordinate deltas through the math box
bd0e	lay the fixed record header
bd13	reset the cursor run length
bd15	append the mantissa/exponent size pair
bd18	the interpolated colour attribute
bd1a	invert the low colour bits
bd21	floor the intensity to a visible minimum
bd23	seat the colour in the high nibble
bd27	write the colour/intensity byte
bd2c	write the companion attribute byte
bd2f	record the advanced run length
bd31	the style selector indexes the template tables
bd33	entry glyph word, high
bd36	entry glyph word, low
bd3b	emit the templated glyph word
bd3e	the object depth
bd42	near object: draw at full size
bd45	depth minus the seed -- a 16-bit difference
bd47	into the math-box operand low
bd4e	math-box operand high
bd53	iteration count
bd58	divisor
bd5b	issue the divide
bd5e	poll the math-box busy bit
bd61	spin until the divide is done
bd63	read the result low
bd68	read the result high
bd6f	reload the iteration count
bd77	clamp the high byte to at least 1
bd7b	normalize: count the shifts
bd7f	until a 1 rolls out of the top
bd82	two's-complement fold into the exponent
bd8c	near path: mantissa 1
bd8e	exponent 0 -- full size
bd90	store the mantissa
bd96	write the exponent byte
bd9a	tag the mantissa with 0x70
bd9c	write the mantissa byte
bda0	stash the style/shape selector
bda2	first endpoint from source corner
bda7	first endpoint, second axis
bdae	carry the depth to the second endpoint
bdb4	next corner, wrapping the 16-corner ring
bdb7	second endpoint
bdbc	second endpoint, second axis
bdc3	seed the clamp tally
bdc7	seed the run size to 4
bdcb	the depth-force flag
bdcd	bit 7 forces the segment to draw
bdcf	object depth
bdd5	too near the rim, skip the segment
bdd6	this corner's record count
bddb	start of this corner's packed table
bde4	emit the run's colour/style word
bde7	project the first endpoint
bdec	lay its header record
bdef	move in the second endpoint
bdfb	project the second endpoint
be02	emit the run's tag-70 word
be05	delta 1: projected Y minus previous Y
be0a	the segment's direction magnitude
be10	its sign high byte
be16	clamp the magnitude on overflow
be33	delta 2: projected X minus previous X
be38	the segment's direction magnitude
be3e	its sign high byte
be44	clamp on overflow
be63	scale the Y-delta into the x1..x7 offset ladder
be9d	scale the X-delta into the x1..x7 offset ladder
bedb	walk the packed corner table
bedd	the record's vector-generator header
bee4	header 1 is shorthand for the 0xc0 draw-mode
bee8	the packed sign/index selector byte
bef2	low 3 bits index the spread for the point
bef7	doubled copy carries the x sign into bit 7
befd	next 3 bits index the cross offset
bf02	combine the packed sign with the direction sign
bf04	negate the offset when the signs differ
bf26	combine with the second direction sign
bf8e	write the record's X low
bf93	clamp X high to the low 5 bits
bf9a	write the record's Y low
bfa1	OR in the record header
bfa3	write the record's Y high
bfa8	one record done
bfac	loop over the corner's records
bfb2	advance the display cursor past the run
c098	load the object depth (Z)
c09b	subtract the reference depth -- form the depth delta
c09d	feed the math-box divisor low byte
c0a2	borrow through the depth guard byte
c0a4	feed the math-box divisor high byte
c0a7	skip the clamp when the divisor stayed non-negative
c0ab	clamp the divisor high byte to zero
c0b0	floor the divisor low byte at 1 -- never divide by zero
c0b3	load the point X
c0b5	compare against the X reference
c0b9	X minus reference -- positive branch
c0bb	mark the X delta positive
c0c3	reference minus X -- negative branch
c0c5	mark the X delta negative
c0c7	feed the X magnitude as the math-box operand
c0ca	trigger the divide for the X projection
c0cd	stash the X sign
c0cf	load the point Y
c0d1	compare against the Y reference
c0d5	Y minus reference -- positive branch
c0df	reference minus Y -- negative branch
c0e3	stash the Y magnitude
c0e5	stash the Y sign
c0e7	read the math-box busy status
c0ea	spin while the math box is busy
c0ec	read the math-box result low byte
c0ef	into the projected X accumulator low
c0f1	read the math-box result high byte
c0f4	into the projected X accumulator high
c0f6	reload the Y magnitude
c0f8	feed it as the math-box operand
c0fb	trigger the divide for the Y projection
c0fe	test the X sign
c100	branch to the subtract path on a negative sign
c105	add the X offset low into the projected X
c10b	add the X offset high with carry
c10d	branch past the saturation clamp on no overflow
c113	saturate the projected X to positive maximum
c11d	offset minus projected X -- negative-sign path
c123	subtract the projected-X high with borrow
c125	branch past the clamp on no overflow
c12b	saturate the projected X to negative maximum
c12f	read the math-box busy status
c132	spin while the math box is busy
c134	read the math-box result low byte
c137	into the projected Y accumulator low
c139	read the math-box result high byte
c13c	into the projected Y accumulator high
c13e	test the Y sign
c140	branch to the subtract path on a negative sign
c145	add the Y offset low into the projected Y
c14b	add the Y offset high with carry
c153	saturate the projected Y to positive maximum
c15b	offset minus projected Y -- negative-sign path
c169	saturate the projected Y to negative maximum
c16e	stage the level's text line into the vector buffer
c173	seed the projection Y reference
c177	mark the display dirty for a full redraw
c17a	build the tube lane coordinates
c17d	test the one-shot level-layout trigger
c182	strobe the vector-generator reset when the trigger was already clear
c187	force the one-shot layout trigger clear
c18a	load the first level display-list head word
c18d	latch it into the vector-list header low
c190	load the second head word
c193	latch it into the vector-list header high
c196	load the level selector
c198	mask the selector bits
c19e	clamp the selector to 0x5f
c1a0	halve the selector
c1a1	form the packed-table read index
c1a6	read a packed level-layout byte
c1a9	take the low nibble
c1ab	write it into the working nibble table
c1ae	mirror it into color RAM
c1b1	re-read the packed byte
c1b8	write the high nibble into the second nibble table
c1bb	mirror it into color RAM
c1c0	loop over the eight table entries
c1c3	clear the zero-page projection scratch cells
c1d3	zero the math-box coprocessor input ports
c1f9	load step count 0x0f to arm the math box
c235	index the player's progress slot
c237	read the per-slot level value
c239	reduce it to a shape-table index
c240	read the per-shape tube-depth parameter
c243	negate the depth
c248	into the depth high byte
c24a	and into the depth target
c24f	form 0x10 minus the depth into the span cell
c255	set the depth-low guard to 0xff
c257	read the per-shape X reference
c25a	into the projection X reference
c25c	read the per-shape level gate flag
c25f	into the tube-geometry flag
c262	load the pending game mode
c266	branch unless the pending mode is 0x1e
c268	copy the per-shape offset-pair low
c26b	into the X offset low
c26d	copy the per-shape offset-pair high
c270	into the X offset high
c275	offset-pair low minus current -- geometry scale
c27b	store the geometry scale low byte
c281	offset-pair high minus current
c286	shift the 16-bit scale right by four
c28f	clear the Y offset low
c291	clear the Y offset high
c29d	seed the record-count cell at 0x2c
c2a0	restore the packed shape index
c2a4	read the ROM lane vertex X
c2a7	into the working lane base X
c2aa	read the ROM lane vertex Y
c2ad	into the working lane base Y
c2b2	clear the per-column plane-A value
c2b5	clear the per-column plane-B value
c2b8	clear the per-lane target flag
c2bb	read the ROM ring-heading seed
c2be	into the segment direction table
c2c3	loop over the sixteen lanes
c2cd	sum adjacent lanes' X
c2d0	rounding-average into the midpoint X
c2d1	store the lane midpoint X
c2d8	sum adjacent lanes' Y
c2db	rounding-average into the midpoint Y
c2dc	store the lane midpoint Y
c2e2	wrap the second cursor back to the top lane
c2e5	loop the midpoint fill
c2ea	pass values under 0x62 straight through
c2ee	otherwise pull the POKEY random byte
c2f1	mask it to range
c2f7	bump the quotient
c2f9	subtract 0x10
c2fd	loop -- quotient is the value shifted right four, A the remainder
c300	map the remainder through the ROM shape table
c303	store the shape/level index
c30a	force the low nibble to 0x0f
c30d	test whether the rim counter is already live
c310	skip the first-time setup when it is
c314	seed the object depth at the far wall
c318	project all lanes -- returns the clamp count
c31b	store it as the rim counter
c320	mirror it into the second counter
c32a	seed the object depth at the near rim
c32c	snap the depth up to reference
c333	project the lanes again
c336	store the near counter
c33b	emit a blank leading vector word
c340	select color mode 6
c342	load the rim counter
c347	bail when the counter is zero
c348	load the record-count cell
c34d	bail when it is zero
c352	clear a framed counter slot pair
c356	loop over sixteen slots
c35a	select color mode 6
c35e	emit a tagged vector word
c363	load the far rim counter
c366	draw its record set
c36b	load the near rim counter
c36e	return when the gate byte is nonzero
c370	seat the slot loop index
c372	load the column plane-A sub into the projected Y low
c377	load the plane-A value into the projected Y high
c37c	load the plane-B sub into the projected X low
c381	load the plane-B value into the projected X high
c388	emit the object's position vector
c38d	cache the draw cursor low
c391	cache the draw cursor high
c395	test the tube-geometry flag
c39a	drop to fifteen passes when the flag is set
c39d	set the record header to 0xc0
c3a1	step the slot index back one
c3ae	wrap the index up by 0x10 on low-nibble underflow
c3b2	emit the projected slot record
c3b7	loop the passes
c3bd	projected Y low minus previous -- delta low
c3bf	store the Y delta low
c3c3	subtract the previous Y high
c3c5	store the Y delta high
c3ca	projected X low minus previous -- delta low
c3cc	store the X delta low
c3d0	subtract the previous X high
c3d2	store the X delta high
c3d6	emit the coordinate delta record
c3db	latch the current Y low as previous
c3e3	latch the current X low as previous
c3eb	reset the record header to 0xc0
c3ee	seat the slot index
c3f0	save the color header
c3f5	emit a tagged vector word
c3f8	load the slot's coordinate block
c3fd	emit the object's position vector
c401	restore the live color header
c404	emit the colored slot record
c407	step the slot back one
c40d	blank the header for the uncolored pass
c411	emit a tagged vector word
c414	re-emit the slot record uncolored
c418	restore the color header
c41a	reload the slot's coordinate block
c41d	close the frame via the coordinate-delta record
c420	return the stepped-back index
c423	load the slot index
c425	load plane-A sub into the projected Y low
c42a	load plane-A value into the projected Y high
c42f	load plane-B sub into the projected X low
c434	load plane-B value into the projected X high
c439	emit the coordinate delta record
c43c	load the slot index
c43e	load the per-object Y-delta low
c443	load the per-object Y-delta high
c448	load the per-object X-delta low
c44d	load the per-object X-delta high
c453	load the depth-low guard
c455	bail unless the guard is clear
c45a	object depth minus reference
c460	bail when the gap is too wide
c465	form reference plus 0x0f
c46d	cap at the ceiling 0xf0
c46f	raise the object depth
c473	seed the object depth from A
c475	stash the output index
c479	clear the clamp tally
c481	load the lane base X into the projection operand
c486	load the lane base Y into the projection operand
c48b	project the point through the math box
c490	load the projected Y low
c492	load the projected Y high
c494	branch to clamp the low side on a negative result
c498	within range -- keep the value
c49c	clamp the high side to +3
c49e	tally the clamp
c4a3	compare against the low limit
c4a9	clamp the low side to -4
c4ab	tally the clamp
c4ad	store the clamped value into plane A
c4b1	store the sign into the plane-A sub
c4b4	load the projected X low
c4b6	load the projected X high
c4c0	clamp the high side to +3
c4c2	tally the clamp
c4cb	clamp the low side to -4
c4cf	tally the clamp
c4d1	store the clamped value into plane B
c4d5	store the sign into the plane-B sub
c4dc	loop over the sixteen lanes
c4de	return the clamp count
c4e1	reduce the input byte to a shape index
c4e4	save the reduced value
c4e6	save the quotient
c4ea	blank the record header
c4ee	emit a leading vector word
c4f6	pick the outline header from ROM
c4f9	stash it as the color mode
c4fd	emit a tagged vector word
c500	load the shape/level index
c505	read the per-shape level gate flag
c50b	roll the first-vertex seed back 0x0f when the gate is clear
c50e	read the ROM lane vertex Y
c511	seed the vertex Y
c513	bias by 0x80
c516	read the ROM lane vertex X
c519	seed the vertex X
c51b	bias by 0x80
c51d	emit the first scaled vertex record
c522	set the record header to 0xc0
c526	sixteen segments
c52a	read the next lane vertex X
c52f	delta from the previous X
c532	cache it as the previous X
c534	read the next lane vertex Y
c539	delta from the previous Y
c53c	cache it as the previous Y
c53f	emit the signed vertex delta record
c546	loop the sixteen segments
c54a	emit the trailing blank word and return
c54d	load the descending-object guard
c550	skip the list when the guard is clear
c554	save the depth high byte
c557	save the depth guard
c55a	save the span cell
c55d	force the depth high to 0xe8
c561	force the depth guard to 0xff
c565	force the span cell to 0x28
c569	eight object slots
c56d	read the object table entry
c570	skip an empty entry
c572	entry into the object depth
c576	center the X operand
c57a	center the Y operand
c57c	load the level
c580	high levels take the per-slot color path
c582	color mode 6 for low levels
c58a	is this the last slot
c58e	the last slot uses color mode 4
c590	store the color mode
c595	emit a tagged vector word
c59c	form the draw style from the slot's low bits
c59f	store the draw style
c5a1	draw the colored shape vector
c5a6	loop the eight slots
c5a9	restore the span cell
c5ac	restore the depth guard
c5af	restore the depth high byte
c5b1	test the award gate
c5b8	require the counter to have reached 0x15
c5bc	index the player's rim segment
c5be	bump that segment's tally
c5c2	load the rim counter gate
c5c7	bail when the counter is live
c5c8	load the depth guard
c5ce	compare the depth against the ceiling
c5d2	bail when the depth is at the ceiling
c5d5	emit a blank leading vector word
c5da	save the draw cursor low
c5dd	save the draw cursor high
c5e0	clear the table cursor
c5e2	clear the draw-cursor offset
c5e6	test the tube-geometry flag
c5eb	drop to fifteen slots when the flag is set
c5ec	seat the slot loop index
c5f2	read the fixed enemy-list header
c5f5	write the header byte through the cursor
c5f9	copy the four header bytes
c5fb	advance the cursor offset
c5fd	test the display-dirty flag
c600	take the midpoint path when dirty
c604	read the lane target flag
c607	a flagged lane takes the full-record path
c60d	read a source record byte
c60f	copy it through the cursor
c613	copy the twelve-byte block
c615	advance the cursor offset
c61c	read the source X low
c61e	copy it through the cursor
c620	cache it as the previous X low
c623	read the source X high
c625	copy it through the cursor
c62b	sign-extend the high nibble
c62d	store the previous X high
c630	read the source Y low
c632	copy it through the cursor
c634	cache it as the previous Y low
c637	read the source Y high
c639	copy it through the cursor
c63f	sign-extend the high nibble
c641	store the previous Y high
c644	advance the cursor offset
c646	emit the enemy-slot entry
c64c	emit the slot midpoint vertex
c64f	emit the enemy-slot entry
c654	shift the lane target flag left
c657	step to the next table slot
c65b	loop the slots
c65e	restore the source pointer high
c661	restore the source pointer low
c666	flush by advancing the display cursor
c66d	read the active tube lane (0..15)
c671	step to the next lane
c673	wrap the neighbour lane index around the 16-lane ring
c676	this lane's Y coordinate
c67a	add the neighbour lane's Y, rounded up by one
c67d	stash the Y sum low byte
c685	carry into the Y sum high byte
c687	halve the 16-bit Y sum, preserving its sign -- the lane-pair Y midpoint
c68c	this lane's X coordinate
c690	add the neighbour lane's X, rounded up
c693	stash the X sum low byte
c69b	carry into the X sum high byte
c69d	halve the 16-bit X sum, preserving its sign -- the lane-pair X midpoint
c6a2	load the running byte offset into the display list
c6a6	write the X midpoint low byte to the display list
c6a9	mirror it as the previous-point X low
c6ad	previous-point X high
c6af	strip the vector-opcode tag bits from the high byte
c6b1	write the X midpoint high byte
c6b6	write the Y midpoint low byte
c6b9	mirror it as the previous-point Y low
c6bd	previous-point Y high
c6bf	strip the vector-opcode tag bits
c6c1	write the Y midpoint high byte
c6c4	commit the advanced list offset -- four bytes appended
c6c7	index by the active enemy slot
c6c9	read the slot's depth/kind byte
c6cc	live slot -> project it; a zero byte means the slot is empty
c6ce	empty slot: load the list offset
c6d4	write a blank byte
c6d7	write the 0x71 blanking word
c6dd	repeat for four placeholder pairs -- keeps the list stride fixed
c6df	commit the advanced offset
c6e2	done
c6e4	live slot: seat the depth as the projection input
c6e6	clamp the depth to the reference point
c6e9	seat this slot's segment midpoint as the point to project (one axis)
c6ee	seat the other axis of the point
c6f3	project the point through the math box
c6f6	emit the projected delta vectors
c6f9	reload the slot index
c6fb	read the slot's target flag
c6fe	test target-flag bit6
c700	flag clear -> draw the fixed marker word
c702	flag set: append a normalized mantissa/exponent pair, advancing the cursor
c705	read a bit of the sound chip's random register
c70b	pick one of two enemy template words at random
c70e	write the template word high byte
c715	write the template word low byte
c71c	commit the offset -- a four-byte record
c71f	done
c721	marker path: load the list offset
c725	write a blank byte
c728	write the 0x68 marker word
c72d	write the blank-slot vector low byte
c733	write the blank-slot vector high byte
c739	commit the advanced offset
c73c	load the running list offset
c73e	X delta: projected X minus the previous point's X
c743	write the X delta low byte
c746	X delta high byte, clipped to five bits
c74c	write it
c74f	Y delta: projected Y minus the previous point's Y
c754	write the Y delta low byte
c757	Y delta high byte, clipped and stamped with the 0xa0 vector opcode
c75f	write it
c762	commit the offset -- two delta words appended
c765	start the write at the cursor head
c768	write the fixed header byte 0x00
c76a	write the fixed header byte 0x71
c770	fall into the position-record builder past the header
c772	public entry: start the record at cursor offset 0
c774	write position-record header byte 0x40
c778	write position-record header byte 0x80
c77e	object X low, cached as the previous point's X low
c782	write it
c785	object X high, cached, clipped to five bits
c78b	write it
c78d	object Y low, cached as the previous point's Y low
c792	write it
c794	object Y high, cached, clipped to five bits
c79b	write it
c79d	advance the draw cursor past the six emitted bytes
c7a0	one-time: reset both sound/IO chips
c7a5	seed the live game mode to 0
c7a7	frame boundary: wait until nine interrupts have accumulated (~26.5Hz)
c7ad	consume the interrupt count, start the next frame
c7b1	run the current mode's phase handler
c7b4	seed the next phase and tick the frame clock
c7b7	build this frame's vector display list
c7bb	loop back forever to the frame wait
c7bd	coinage dip config 0x82 disables this whole update pass
c7c6	pre-pass: step the spike-table collapse
c7c9	select the phase handler by the current game mode
c7cd	mark this frame's edge state -- set bit7
c7d1	push the handler's address high byte from the mode dispatch table
c7d5	push its low byte
c7d9	jump to the selected phase handler
c800	while the guarded frame-counter bit is set, suppress the countdown
c807	tick the mode-change delay timer toward zero
c80d	not expired yet -> just service the shooter
c80f	delay expired: commit the pending mode as the live mode
c815	clear the arming guard
c818	advance the player's shooter around the tube rim
c81b	read the phase counter -- phases still owed
c81f	note whether at least two phases remain
c821	extract the pending-advance request bits (6..5)
c825	consume the request, clearing the flags
c827	no advance requested -> the queued-intro path
c829	two or more phases owed -> the double-step branch
c82b	otherwise test request bit5 only
c830	count one step and drain a phase
c833	request bit6 -> a second step
c837	drain another phase for the double step
c83b	store the derived 0..2 level step
c83d	a zero step -> nothing to advance
c83f	latch the advance in the status flags (top two bits)
c847	clear the heartbeat accumulator low byte
c849	clear its overflow byte
c84d	reset the game mode to 0
c84f	index the level tally by the step: 1 -> offset 0, 2 -> offset 3
c857	bump the 16-bit level tally, carrying into the high byte
c85f	advance the on-screen level number by the step (1 or 2)
c865	clamp it to 0x63
c86b	store the new level number
c86e	done
c871	no-advance path: nothing latched -> exit
c875	status bit7 set -> exit
c879	arm the intro dispatch selector
c87d	set the mode-delay countdown
c881	enter mode 0x0a
c885	queue the next mode 0x14
c88b	disarm the latched spinner value
c88d	reset the spike tally
c891	coin input bit4 clear -> force game mode 0x22
c898	force mode 0x22
c89d	skip to the common tail
c89f	status bit6 set -> skip to the tail
c8a3	even phase -> straight to the level-counter step
c8a9	read the phase counter
c8ad	an expired counter arms the phase gate
c8b1	gate clear -> the level-counter step
c8b5	two or more phases owed -> the mode-0x14 branch
c8ba	zero phases -> skip the mode seed
c8bc	one phase: select dispatch 0x16
c8c0	enter mode 0x0a
c8c4	continue to the frame tick
c8ca	set game mode 0x14
c8ce	clear the phase gate
c8d2	run the level-advance bookkeeper only when a phase is owed
c8d6	step the level-advance bookkeeper
c8d9	every fourth frame...
c8df	...reseed the phase counter to 2
c8e3	advance the master frame counter
c8e5	on odd frames...
c8eb	...step the non-volatile high-score store transfer
c8ee	when a sound step is queued...
c8f2	...register the active sound
c8f5	read the decimal-mode guard
c900	arm decimal mode when the guard opens
c901	if this frame's edge bit is set...
c907	...clear the edge flags
c90c	rebuild the control blocks if requested
c90f	build the level's geometry layout
c912	only when the status byte is negative...
c916	...clear the channel staging block
c919	clear the slot-countdown high byte
c91d	start the loop index at the top live slot
c923	seed this slot's countdown from the bonus config
c929	mark the slot's level entry unassigned
c92e	walk down through every live slot
c934	clear the level id
c936	clear the spike-table guard
c939	reload the index to the top slot for the next consumer
c93d	hand off to wave-start slot selection
c940	clear the dispatch selector
c944	seed the game mode and pending mode to 30
c94a	only on a genuine level change...
c950	latch the new level id
c952	...and only when the status byte is negative
c956	install the new-level dispatch selector
c95a	set game mode 10
c95e	pick the level-delay timer -- 40 or 80
c967	store the delay timer
c969	swap the paired geometry tables
c96c	size the projection scale
c971	copy this level's per-slot level into the working cell
c975	run the level startup init
c978	reset the sound chips
c97b	queue mode 0x04 to promote after the delay
c981	clear the dispatch selector
c985	enter the live mode 0x0a
c989	set the promotion countdown
c98c	index this level's enemy-quota cell
c990	quota below the cap?
c992	at the cap -> skip the bump
c994	bump the level's enemy quota
c996	bump its working copy in lockstep
c998	enter wave-active mode
c99c	if this level carries a bonus trigger...
c9a1	seat it as an in-page pointer
c9a6	add it to the score at the top threshold
c9a9	cue the score-award sound
c9ac	bring the wave up
c9af	clear the mode-delay timer
c9b3	tick the active slot's pacing countdown low byte
c9b7	if the whole countdown pair is spent...
c9bd	...reload the wave's pacing from the peak slot
c9c0	and return
c9c5	if this tick zeroed the active slot...
c9c9	...raise the dispatch selector
c9cd	and set the mode delay
c9d5	toggle to the other pacing slot
c9dd	keep toggling until a non-empty slot is found
c9e1	pick the slot's arm value -- 0x1c on wrap, else 0x02
c9ea	queue it as the pending mode
c9ec	request the pacing mode 0x0a
c9f1	reset the running peak
c9f6	scan from the top live slot down
c9f8	keep the highest per-slot level seen
ca02	across the whole live window
ca05	seed the pacing floor with peak-1 -- zero stays zero
ca0d	pick the next mode -- 0x10 when the status byte is negative, else 0x14
ca15	request it
ca18	load the status flags
ca1a	keep only the low six gating bits -- clear the play/active-state flags
ca1c	store the masked status back
ca20	clear the active-slot count
ca24	queue the mode to promote once the delay expires
ca28	set the live game mode
ca2c	arm the mode-promotion countdown
ca30	arm the guard holding the pending transition
ca35	set the pre-doubled dispatch selector paired with the mode
ca48	default projection scale
ca4a	read the spinner heartbeat flag
ca4d	skip the alternate regime if the flag is clear
ca4f	read the active seat
ca51	skip the alternate regime if no live seat
ca53	alternate mode-bit source
ca55	alternate projection scale
ca57	masked bit-merge -- fold only bit 2 of the chosen value into the vector-mode flag
ca5d	store the updated vector-mode flag
ca5f	publish the projection scale for the depth math
ca62	value to write
ca64	index over the six staging cells
ca66	zero one sound-request staging cell
ca69	loop until the whole staging block is blank
ca6c	switch to BCD arithmetic for the score add
ca6d	test the scoring-armed flag -- bit 7 of the status byte
ca6f	bail out unless scoring is armed
ca71	read the active seat
ca75	player-two score bank offset
ca77	small index selects a fixed point value, else the live operand triplet
ca79	branch to the fixed score-value table path
ca7b	live operand low byte
ca7e	add it into the score low byte
ca81	store the running score low byte
ca84	live operand mid byte
ca86	add into the score mid byte with carry
ca89	store the running score mid byte
ca8c	live operand high byte
ca91	low byte of the point value from the score-value table
ca95	add into the score low byte
ca98	store the running score low byte
ca9b	high byte of the point value from the score-value table
ca9e	add into the score mid byte with carry
caa1	store the running score mid byte
caa4	fixed-table value has no third byte
caa7	add the third byte into the score high cell with carry
caaa	store the running score high byte
cab0	read the bonus-life interval
cab5	compare it against the operand high byte
cab7	exact landing -- grant the award
cabd	reload the bonus-life interval
cac2	tiny interval takes a direct compare, else repeated subtraction
cac6	repeatedly subtract the bonus interval from the score high byte
caca	exact multiple of the interval -- grant the award
cacc	keep subtracting while it still fits
cadc	read the active seat
cade	load this seat's bonus-life counter
cae0	cap the counter at six
cae2	skip the award if already at the cap
cae4	grant the extra life -- bump the counter
cae6	fire the score-award chime
caeb	kick the rim colour animation
caef	back to binary arithmetic
ccb0	sound id -- fixed effect 0x5f
ccb2	hand it to the sound-enable gate
ccb5	sound id -- rim-rotation click
ccb7	branch into the enable gate
ccb9	sound id -- score-award chime
ccbb	branch into the enable gate
ccbd	sound id -- effect 0x8f
ccbf	branch into the enable gate
ccc1	sound id -- enemy-spawn cue
ccc3	test the sound-enable flag -- bit 7 of the status byte
ccc5	muted: drop the cue and return
ccc7	stash the caller's X/Y
cccb	sound id becomes the starting index into the voice table
cccc	walk all sixteen voice slots
ccce	read this slot's byte from the voice table
ccd1	zero byte is a gap -- leave the slot untouched
ccd3	mark the slot being claimed
ccd5	load the voice value into the slot
ccd9	arm the fast timer
ccdb	arm the slow timer
ccdf	restore the idle sentinel
cce3	loop over the remaining slots
cce5	restore the caller's X/Y
ccea	sound id -- new enemy entering the tube
ccec	branch into the enable gate
ccee	sound id -- moving-spike start cue
ccf0	branch into the enable gate
ccf2	sound id -- moving-spike end cue
ccf4	branch into the enable gate
ccf6	sound id -- segment-hit chime
ccf8	branch into the enable gate
ccfa	sound id -- currently-held active cue
ccfc	branch straight to the voice loader -- bypass the enable gate
ccfe	sound id -- level-intro / skill-step start
cd00	branch into the enable gate
cd02	load fixed sound id 0x3f -- the enemy direction-reversal cue on the rim
cd04	hand the id to the sound-enable gate -- queued only while sound is on
cd06	load fixed sound id 0xcf -- the spike-strikes-blaster hit
cd08	hand the id to the sound-enable gate
cd0a	start at sound slot 15 and walk down to 0
cd0c	read this slot's envelope pointer
cd0e	skip an idle slot (pointer 0)
cd10	is this the reserved slot
cd12	skip the reserved slot
cd14	age the slot's fast timer
cd16	still running -- nothing more for this slot this frame
cd18	fast timer expired -- age the slow timer too
cd1a	slow timer still running -- take a single envelope step
cd1c	both timers expired: advance the envelope pointer by two
cd1e	(second half of the two-step advance to the next frame)
cd20	reload the envelope pointer
cd22	double it into a word-stride table index
cd24	top bit set -- read the frame from the high envelope table
cd26	low table: load the frame's level byte
cd29	store it as the slot's level
cd2b	load the frame's slow-timer reload
cd2e	store the slow timer
cd30	load the frame's fast-timer reload
cd36	high table: load the frame's level byte
cd39	store it as the slot's level
cd3b	load the frame's slow-timer reload
cd3e	store the slow timer
cd40	load the frame's fast-timer reload
cd43	store the fast timer
cd45	nonzero fast timer -- a real frame, publish it
cd47	zero fast timer: park the envelope pointer at 0
cd49	reload the level byte
cd4b	level 0 is a terminator -- publish
cd4d	otherwise treat the level as the next pointer
cd4f	keep walking the envelope
cd54	single-step path: double the pointer into a table index
cd56	top bit set -- read from the high envelope table
cd58	low table: load the fast-timer reload
cd5b	reload the fast timer
cd5d	load the level increment
cd63	high table: load the fast-timer reload
cd66	reload the fast timer
cd68	load the level increment
cd6b	fetch the running level
cd6e	add the increment into the running level
cd70	store the stepped level
cd73	test whether this is an odd slot
cd74	even slot -- publish as is
cd77	odd slot: preserve the prior high nibble of the level byte
cd79	(mask off the low nibble of the delta)
cd7b	(merge back the retained high nibble)
cd7d	store the merged level
cd7f	load the slot's level to publish
cd81	slots below 8 use the first sound chip
cd85	publish the level to the second sound chip's voice register
cd8b	publish the level to the first sound chip's voice register
cd8e	step down to the next slot
cd8f	done all 16 slots
cd91	loop to the next slot
cd97	hold the first sound chip in serial reset (control latch 0)
cd9a	hold the second sound chip in serial reset
cd9d	clear the random-seed scratch cell
cda0	poll the entropy registers up to five times
cda2	snapshot the first chip's free-running random register
cda5	snapshot the second chip's random register
cda8	has the first chip's random register advanced
cdad	has the second chip's advanced
cdb0	neither moved -- keep polling
cdb2	one moved -- latch the snapshot as the random seed
cdb5	stop polling
cdba	release value for the serial-control latch
cdbc	release the first chip (control latch 7, the init handshake)
cdbf	release the second chip
cdc2	walk the eight audio registers of each chip
cdc6	silence a first-chip audio register
cdc9	silence a second-chip audio register
cdcc	clear the slot's software voice-value mirror
cdce	clear the slot's software voice-level mirror
cdd5	clear the first chip's control register
cdda	clear the second chip's control register
cf24	step the three timebase lanes, x = 2,1,0
cf26	read the latched input port for this lane's control bits
cf2f	shift out this lane's control bits
cf32	load this lane's wrapped position
cf34	mask to the 0..0x1f rail
cf36	control bit set -- take the wrap-up path
cf38	position at 0 -- store as-is
cf3a	near the top rail
cf3f	read the interrupt sub-timer
cf41	take its low phase
cf43	pace the step to sub-timer phase 7
cf48	decrement the position with borrow
cf4a	store the updated lane position
cf4c	test input bit 3
cf53	prime the sound-step gate to 0xf0
cf57	read the sound-step gate
cf5b	tick the sound-step gate down
cf5f	reset this lane's position on gate drain
cf61	reset this lane's down-timer
cf64	read the lane down-timer
cf68	decrement the down-timer
cf6c	timer reached 0 -- flag an event tick
cf6f	wrap-up path: position near the top rail
cf73	load the position
cf75	add 0x20 to the position
cf7c	rail the position at 0x1f
cf80	store the railed position
cf82	read the down-timer
cf87	reload the lane down-timer to 0x78
cf89	store the reloaded down-timer
cf8b	no event this lane -- skip the accumulator fold
cf8f	select the increment by lane
cf95	lane 2: take option bits 2-3 as the increment
cf9d	bias the increment
cfa1	lane 1: option bit 4 selects
cfa7	a +1 increment
cfab	fold the increment into the accumulator low byte
cfad	store the accumulator low byte
cfb1	carry into the accumulator high byte
cfb3	store the accumulator high byte
cfb5	bump this lane's event counter
cfb7	advance to the next lane
cfba	loop to the next lane
cfbd	option top three bits index the reduction table
cfc5	load the accumulator low byte
cfc8	drain it by the option-indexed reduction amount
cfcd	store the drained low byte
cfcf	advance the overflow tally
cfd1	at the maximum reduction index
cfd5	advance the overflow tally a second time
cfe1	option low two bits select a high-byte correction
cfee	apply the correction to the accumulator high byte
cff2	carry it through the overflow tally
cff6	store the overflow tally
cffe	step the phase counter
d000	step the phase counter again
d002	commit the accumulator high byte
d004	gate the clamp passes on the sub-timer's low bit
d007	odd sub-timer -- skip the clamp
d00b	first clamp pass over the three lane counters
d00d	read a lane counter
d011	is it 0x10 or more
d015	reduce it by 0x11
d017	tally that a lane was reduced
d018	store the reduced counter
d01d	any lane reduced
d01e	yes -- skip the second pass
d020	second clamp pass over the lane counters
d022	read a lane counter
d027	reduce it by 0x11
d029	store it
d02b	stop at the first that goes negative
d6bb	read the options DIP-switch port
d6be	snapshot the options byte
d6c0	bits 5-3 select the bonus-life interval
d6c6	read the bonus-interval table
d6c9	store the live bonus-life interval
d6cc	read the coinage DIP-switch port
d6cf	toggle bit 1
d6d1	store the coinage snapshot
d6d3	bits 7-6 select the bonus config
d6db	read the bonus-config table
d6de	store the bonus config
d6e1	take the two-bit difficulty field
d6e6	read paired config entry A
d6e9	store config A
d6eb	read paired config entry B
d6ee	store config B
d6f0	fold config B through the pot/status merge
d6f3	store the merged difficulty config
d70a	read the stack pointer for the depth guard
d70b	stack too shallow
d70f	read the heartbeat counter for the sign guard
d711	heartbeat still positive -- proceed
d713	guard tripped -- force a reset
d714	divert to the power-on reset
d717	kick the watchdog and acknowledge the interrupt
d71a	pulse the first chip's pot-scan start
d71d	read the spinner pot
d720	invert the pot reading
d723	stash the pot's bit-4 flag
d72a	form the delta versus the previous pot reading
d72c	keep the low nibble
d72e	is the delta's sign bit set
d732	sign-extend the 4-bit delta
d735	accumulate the delta into the spinner accumulator
d737	store the spinner accumulator
d739	save this frame's pot reading
d73b	mirror the accumulator to the second chip's pot register
d73e	read the coin/switch input
d741	latch the raw input port
d744	store the input latch
d746	last frame's inputs
d748	latch this frame's coin/switch inputs
d74f	update the debounced-input cell
d756	settle the debounced inputs
d759	compare against the previous held state for edges
d75f	record the newly-pressed edge flags
d761	save the held state
d763	base the output flags on the vector scale
d765	lane-0 status counter
d769	set a bit for an active lane-0 counter
d76f	set a bit for an active lane-1 counter
d775	set a bit for an active lane-2 counter
d777	write the coin-counter / screen-flip output latch
d77d	status flags set -- use the phase index + 1
d783	idle: sub-timer still low -- index 0
d789	else the phase counter (0 or 1)
d78f	else a fixed index 3
d791	read the vector-generator state-code table
d794	fold its low two bits into the draw-mode flag
d79c	mirror the draw mode to the LED / screen-flip latch
d79f	run the timebase lane engine
d7a2	run the per-frame sound engine
d7a5	advance the heartbeat counter
d7a7	advance the interrupt sub-timer
d7a9	only on the sub-timer wrap, run the timer cascades
d7ab	carry into timer-1 low byte
d7b0	carry into timer-1 mid byte
d7b5	carry into timer-1 high byte
d7b8	the second cascade is gated by a status flag
d7bc	carry into timer-2 low byte
d7c1	carry into timer-2 mid byte
d7c6	carry into timer-2 high byte
d7c9	is the vector-generator-done input asserted
d7ce	bump the redraw counter
d7d1	strobe the vector-generator reset
d7d4	strobe the vector-generator go -- launch the redraw
d7e3	clear the status/flags byte
d7e7	arm the dispatch selector to 2
d7e9	high-score store busy
d7ec	busy -- bail
d7ee	read the feature-enable input
d7f3	feature disabled -- bail
d7f7	set idle game mode
d7f9	check the pending-work bits
d7fe	nothing queued -- bail
d800	rebuild the control blocks from their template
d804	read the option DIP switches
d807	draw the overlay frame
d80a	build the pot readout list
d80d	build the large decimal number
d810	marker repeat count from the bonus config
d815	emit the vector-list header word
d81c	emit a scaled coordinate record
d823	emit a marker coordinate word
d826	decrement the marker count
d828	repeat the marker that many times
d82a	difficulty (0..3) doubled into a table index
d831	read the difficulty coordinate pair (high byte)
d834	read the difficulty coordinate pair (low byte)
d837	emit the difficulty coordinate word
d83a	read the player's rim segment
d83d	fold it through the step-into-fraction helper
d840	write the folded segment back
d843	segment-selected table index
d847	read the segment coordinate pair (high byte)
d84a	read the segment coordinate pair (low byte)
d84d	emit the segment coordinate word
d853	load the debounced inputs
d855	mask them with the diagnostic mask-table entry
d858	compare against the mask
d85b	not every mask bit present -- skip the erase work
d861	slot underflow -- force a full reset
d866	erase the low high-score-store regions
d86c	queue a single high-score-store region erase
d872	arm the pending erase-work bits
d874	store the pending-work byte
d877	read the high-score-store mode flag
d87a	and it with the blank flag
d87d	flags disagree -- skip the extra word
d87f	emit an extra coordinate word (high byte)
d886	emit the second header word
d889	coinage bits 2-4 select the low diagnostic digit
d890	read the low digit value
d897	draw it as a scaled digit
d89a	coinage top three bits select the high digit
d8a2	read the high digit value
d8a9	stash the byte to draw
d8ac	emit the scaled coordinate record for the anchor
d8af	point at the stashed byte
d8b1	one digit
d8b3	lay the byte down as a single-digit glyph run
d8ca	hold the passed byte as the burst count
d8cb	seed the pass count to 0
d8cd	store the burst count
d8d4	one extra pass when the count's low nibble is 0
d8dc	set voice-1 control -- tone on
d8e0	is this the final pass
d8e2	final pass: low tone, nine drains
d8e9	normal pass: high tone, one drain
d8ed	write voice-1 frequency -- the tone
d8f2	strobe the LED / screen-flip latch
d8f7	sync to the 3kHz line
d901	kick the watchdog through the tone drain
d90a	silence voice-1
d90f	clear the LED / screen-flip latch
d91e	kick the watchdog through the silent gap
d92a	loop until the pass counter underflows
d92c	continue into the ROM checksum
d92f	fold one table byte into the running tone byte
d931	carry the folded byte as the burst count
d932	read the dispatch selector as the pass seed
d934	is the seed 0x20 or more
d938	fold high seed values back into range
d93a	keep the low five bits
d93c	drive the power-on tone bursts
d93f	mask interrupts at the reset entry
d940	kick the watchdog
d943	strobe the vector-generator reset
d948	seat the stack
d94d	set up a rolling zero-page pointer for the RAM wipe
d94f	(pointer high byte)
d953	zero a work-RAM byte
d956	wipe the whole page
d959	reached the unmapped gap
d95d	resume at the 0x2000 vector-RAM window
d95f	wipe through 0x2fff
d961	kick the watchdog during the wipe
d964	continue the wipe
d968	clear the LED / screen-flip latch
d96b	hold the first sound chip in reset
d96e	hold the second sound chip in reset
d973	release the first sound chip (control latch 7)
d976	release the second sound chip
d97a	silence a first-chip audio register
d97d	silence a second-chip audio register
d983	read the self-test switch
d988	switch held -- run the RAM diagnostic
d98a	normal boot: kick the watchdog through a settle delay
d98d	settle-delay countdown low byte
d992	settle-delay countdown high byte
d999	set the vector-generator scale
d99b	arm the high-score-store readback
d99e	rebuild the control blocks from their template
d9a1	build the level layout
d9a4	enable interrupts
d9a5	enter the main frame loop
d9af	RAM diagnostic: write a walking pattern to a cell
d9b4	read the cell back
d9b9	verify failed -- sound the error tone
d9c1	kick the watchdog during the test
d9c5	check the read-back byte against the pattern
d9c8	mismatch -- error tone
d9ca	advance the pattern
d9e0	second pass: read a byte, expect zero
d9e4	nonzero -- error tone
d9e9	write a walking-ones pattern
d9eb	read it back
d9ef	mismatch -- error tone
d9f7	clear the cell again
d9fc	kick the watchdog
da00	reached the unmapped gap
da04	resume at the 0x2000 window
da08	cover through 0x2fff
da0e	set the ROM-scan pointer low byte
da12	pointer high byte -- first ROM bank
da16	eight pages per bank
da18	seed this bank's checksum with the bank index
da19	fold each ROM byte into the checksum
da1e	advance to the next page
da20	kick the watchdog once per page
da23	eight pages per bank
da27	store this bank's checksum
da29	next bank
da2e	after two banks, jump to the high ROM window
da32	twelve banks total
da36	bank-0 checksum nonzero -- a bad ROM
da3a	arm the error tone -- voice-3 frequency
da41	error-tone voice-3 control
da46	sample the first chip's random register
da49	re-read until it reads stable
da51	store the settled entropy sample
da55	sample the second chip's random register
da58	re-read until stable
da60	store the second entropy sample
da62	arm the high-score-store readback
da67	branch on the pending-work byte
da6c	stash the pending-work value
da6e	queue an erase of every high-score-store region
da73	clear the pending-work byte
da76	set the diagnostic mode state
da7a	copy the self-test colour table
da7d	into colour RAM
da85	blank the LED / screen-flip latch
da8a	idle the coin-counter / flip output latch
da91	busy-wait on the video sync line
daa1	kick the watchdog
daa7	loop on the vector-generator-done line
daa9	strobe the vector-generator reset
daae	reset the draw cursor low byte
dab2	draw cursor high byte -- cursor at 0x2000
dab4	pulse the first chip's pot scan
dab7	read the spinner pot
daba	save the pot reading as the previous value
dabc	keep the low nibble
dabe	store it
dac0	read and invert the input port
dac5	mask the input edges
dac7	store the edge flags
dac9	either diagnostic-select bit set
dacd	shift the diagnostic-select state
dad1	advance the diagnostic page by two
dad8	reset the select state
dadc	build the diagnostic frame
dadf	emit the headered body record
dae2	strobe the vector-generator go
dae5	tick the frame counter
dae9	every fourth frame
daed	service one high-score-store transfer step
daf0	read the self-test switch
daf5	still held -- run another diagnostic frame
daf7	switch released -- spin until the watchdog resets the board
db0f	read the per-frame draw-handler selector from the game-mode cell
db11	range-check the handler offset against the table size
db13	in range -- dispatch the selected handler
db15	out of range -- clamp the selector to handler entry 1
db17	persist the clamped selector back to the game-mode cell
db19	push the selected handler's address high byte from the dispatch table
db1d	push the handler's address low byte from the dispatch table
db21	rts-dispatch into the chosen draw handler
db24	zero the LED/flip/coin latch
db27	zero the mathbox R0-low load register
db2a	zero POKEY 1 pitch
db2d	zero POKEY 2 pitch
db30	zero the EAROM data latch
db33	zero the EAROM control latch (0x6040 write) -- a write here hits EAROM control, not the read-only mathbox status
db36	dummy read to let the mathbox status flip-flop settle
db39	dummy read of the mathbox result low byte
db3c	dummy read of the mathbox result high byte
db3f	dummy read of the EAROM read latch
db44	raise the LED/flip latch
db47	seed a single set bit for the walking-bit march
db49	prepare to march across 32 mathbox load slots
db4c	write the walking-bit pattern into mathbox load slot x
db4f	rotate the set bit up through carry
db51	loop the 32-slot bit march
db57	emit one framing coordinate word (tail)
db5a	read the EAROM mode/active-operation flag
db5d	OR in the queued-region (pending) flag -- bail if a sequence is pending or running
db60	a sequence is already pending or running -- bail
db62	arm the EAROM readback state machine
db65	copy the pending-work flags...
db68	...into the walk's scratch cell
db6c	advance the game-mode cell
db6f	read the spinner accumulator (player rotation count)
db71	halve it
db75	emit a 0x68-tagged header word carrying half the spinner count
db7c	emit the fixed header and clear the slot banks
db82	emit the primed header (pair 0x32,0xb6) and clear the slots
db88	emit the caller's framing word into the display list
db8f	silence POKEY 1 voice control at even slot x
db92	silence POKEY 2 voice control at even slot x
db97	loop the four even AUDC slots
db9a	read the frame counter
db9c	gate on the low six bits -- once every 64 frames
dba0	advance the 8-phase sound/vector sequencer
dba4	mask the phase to 0..7 for the sequencer row index
dba7	pick this phase's voice to silence from the row table
dbac	silence that POKEY 1 voice
dbaf	pick this phase's voice to fire from the row table
dbb2	read this phase's value byte from the row table
dbb5	set the fired voice's frequency
dbba	fire it at fixed volume and distortion
dbc1	emit the opening coordinate word
dbc4	take the low seven bits of the frame counter
dbcb	emit a tag-70 word that scrolls with time
dbd2	emit the closing coordinate word (tail)
dbe0	strobe POKEY 2 pot scan with the incoming value
dbe3	read POKEY 2 pot lines (ALLPOT at 0x60d8)
dbe6	keep the low three control bits
dbe8	mirror them into scratch
dbea	and into the POKEY 1 pot-scan strobe
dbed	read POKEY 1 pot lines (ALLPOT at 0x60c8)
dbf0	isolate bit 5
dbf3	shift it down to bit 3
dbf4	merge with the low three bits
dbf6	return the assembled pot-status byte
dbf7	read the sweep counter low byte
dbf9	counter zero -- skip the mathbox scan
dbfb	seed mathbox R7 low with the counter
dbfe	and mathbox RA low
dc01	read the sweep counter high byte
dc03	seed mathbox R7 high
dc08	run the mathbox divide
dc0b	result A == 1?
dc0d	A != 1 -- force the status byte to 0xff
dc10	A == 1 but Y != 0 -- force the status byte to 0xff
dc13	remainder positive -- clear (keep X as the status byte)
dc17	force the spread/scan flag to 0xff
dc1b	clear the vector-record header
dc1d	advance the sweep counter low byte
dc21	carry into the sweep counter high byte
dc25	wrap the high byte at bit 7 (7-bit sweep)
dc27	write the decided status byte to the POKEY 2 pot-scan strobe
dc2a	read POKEY 2 pot lines (ALLPOT at 0x60d8)
dc2d	keep the option bits
dc2f	stash the debounced input
dc31	no bits set -- leave voice 1 silent
dc33	set POKEY 1 voice 1 frequency
dc36	arm voice 1 control
dc38	write POKEY 1 voice 1 control
dc3d	read the input edge flags
dc3f	none set -- leave voice 2 silent
dc42	set POKEY 1 voice 2 frequency (edge flags << 1)
dc45	arm voice 2 control
dc47	write POKEY 1 voice 2 control
dc4a	build the DIP/pot diagnostic readout
dc53	render the debounced-input byte as eight per-bit digits
dc58	render the edge-flags byte as eight per-bit digits
dc5b	read the previous spinner-pot sample
dc5d	test bit 4
dc5f	clear -- skip the marker and latch writes
dc65	emit a marker coordinate word
dc6a	read the debounced input
dc6c	test the coin/mode bits
dc6e	none set -- skip the latch write
dc70	flip bit 5 -- result zero iff only the coin bit (bit 5) was set
dc72	exactly bit 5 -- keep the default latch value
dc74	otherwise use the alternate mode value...
dc76	...and the alternate latch value
dc78	write the LED/flip latch
dc7b	write the coin-counter/flip output latch
dc82	emit a coordinate mark
dc85	walk the 12-slot spread table (x = 11..0)
dc87	read spread slot x
dc89	empty slot -- skip
dc8b	stash the slot value
dc8d	save the loop index
dc90	emit a stroke word for slot index + 1
dc99	emit the slot value as a scaled digit
dc9f	emit a scaled coordinate record
dca2	restore the loop index
dca5	next spread-table slot
dca7	emit the header word
dcae	emit a scaled coordinate record
dcb1	walk the 5-slot spread table (x = 4..0)
dcb9	read spread slot x
dcbb	empty slot -- use word index 0
dcbd	pick this slot's coordinate-word index from the table
dcc0	read the coordinate word low byte from the glyph table
dcc3	read the coordinate word high byte from the glyph table
dcc6	emit the coordinate word
dccb	next slot
dcd1	emit the final coordinate mark
dcd4	index by the spinner accumulator
dcd6	read the colour-pair high byte
dcd9	read the colour-pair low byte
dcde	emit the keyed scaled coordinate record (tail)
dce8	clear the vector-record header staging cell
dcea	clear the second staging cell
dced	load mathbox Ra high operand
dcf0	load mathbox Rb low operand
dcf3	clear mathbox Rb high
dcf8	seed the mathbox iteration count
dcfb	strobe the divide to start
dcfe	count down the poll window
dcff	window exhausted -- no result ready
dd01	read the mathbox status
dd04	still busy -- keep polling
dd06	ready -- latch the result low byte
dd09	latch the result high byte
dd0d	emit the fixed header word
dd12	emit a zero-valued tag-70 framing word
dd17	read the coinage DIP bank
dd1a	render it as an eight-bit digit run at column 0xe8
dd1d	read the options DIP bank
dd20	render it as an eight-bit digit run
dd23	pulse the POKEY pot scan and fold to a status byte
dd27	inject the fixed value byte 0xd0
dd29	inject the fixed screen-X column 0xf8
dd2b	stash the byte to render
dd2d	position the eight-bit row on screen
dd30	eight bits to draw
dd34	shift the byte's top bit out
dd38	capture the shifted-out (MSB-first) bit
dd39	emit one stroke word for that bit
dd3e	next bit
dd41	read the input pair low byte
dd44	double it
dd47	read the input pair high byte
dd4a	double it, threading the carry
dd4d	read the coordinate accumulator low byte
dd51	add the doubled input
dd53	store as mathbox R7 low operand
dd58	read the coordinate accumulator high byte
dd5b	add with carry
dd5d	store as mathbox R7 high operand
dd60	test whether the whole operand is zero
dd62	nonzero -- keep it
dd66	floor the operand to one so the divide never sees zero
dd69	load mathbox Ra low from the timer low byte
dd6f	read the timer mid byte
dd72	read the timer high byte
dd75	run the mathbox divide
dd78	stash the quotient
dd7b	stash the remainder
dd82	emit the fixed coordinate header word
dd87	set the source pointer low -> 0x0406
dd8b	set the source pointer high
dd8d	outer loop -- five numbers (post-decrement bpl runs 5 passes; the 5th draws the divide quotient/remainder at 0x0412/0x0413)
dd91	clear the 4-byte BCD accumulator
dd99	load the first binary source byte
dd9f	load the second binary source byte
dda5	load the third binary source byte
ddab	enter decimal mode for double-dabble
ddac	24 source bits
ddb0	shift the 24-bit binary source left one bit...
ddb2	...carry chained low to high...
ddb4	...through the third byte
ddba	BCD-double each accumulator byte with the shifted-out bit
ddc2	across the four BCD bytes
ddc6	next of the 24 bits
ddc8	leave decimal mode
ddcd	emit the converted decimal digit run
ddd4	emit the number's scaled coordinate record
ddd9	next of the five numbers
dde9	select the EAROM region on bit mask 0x04
ddeb	request a blanked (erase) write of that region
dded	load region mask 0x03 -- the two low high-score regions
ddef	jump into the blank-write request builder with the mask
ddf1	load region mask 0x07 -- all three high-score regions -- then build a blank/erase request
ddf3	force the index byte to 0xff, the blank/erase sentinel
ddf5	jump to the shared request tail, mask still in a
ddf7	load region mask 0x03 -- the two low regions -- for a live save
ddf9	jump into the index-zero (live-save) tail
ddfb	load region mask 0x04 -- the third region -- then fall into the live-save tail
ddfd	force the index byte to 0 -- live save, not erase
ddff	store the index/blank byte (0 = live save, 0xff = erase)
de03	merge the mask into the region-pending bits
de06	store the regions awaiting service
de0a	merge the mask into the per-region direction bits
de0d	store direction (set = write out, clear = read back)
de11	command all three regions
de13	set the region-pending bits to read every region back
de16	clear the direction bits
de18	so all regions are read back in, then fall into the transfer step
de1b	read the EAROM step-machine mode/busy byte
de1e	a pass is already active: skip region setup
de20	read the region-pending bits
de23	nothing queued: skip setup
de27	clear the per-region pass counter
de2a	clear the running checksum accumulator
de2d	clear the single-region walking mask
de30	8 bits to rotate -- x also becomes the region index
de33	rotate a set bit into the walking mask
de36	shift the pending bits left, hunting the highest (most-significant) set region bit
de37	count down toward the region index
de38	keep rotating until a set bit falls out
de3a	default to write mode (0x80)
de3f	test the isolated region mask against the direction bits
de42	region flagged write: keep write mode
de44	else read mode (0x20)
de46	arm the step-machine mode for this region
de4c	drop this region's bit out of the pending set
de4f	so it is not serviced again
de53	word-stride the region index into the packed tables
de55	read the region's start cursor from the packed table
de58	seed the region byte cursor
de5b	read the region's end/limit from the packed table
de5e	seed the checksum-position limit
de61	read the region RAM-copy pointer low byte
de64	seed the region walk-pointer low
de66	read the region RAM-copy pointer high byte
de69	seed the region walk-pointer high
de6d	reset the math-box / EAROM control port
de70	read the mode byte
de73	mode active: run a pass
de76	y = which entry of the region is being serviced
de79	x = position in the EAROM data window
de7c	shift the mode byte to select the sub-operation
de7f	stage a data byte into the EAROM data window
de84	arm the write sub-mode (0x40)
de8e	set write mode
de93	read the blank flag
de96	not blanking: keep the RAM byte
de9a	blank the RAM byte through the region walk pointer
de9c	read the RAM byte through the region walk pointer
de9e	reached the region limit?
dea1	not yet
dea5	clear mode: region done
dea8	at the limit, emit the running checksum instead
deab	stage the byte into the EAROM data window
deb5	begin the EAROM read handshake on the control port
debd	clock the control port
dec3	return the control port
dec6	reached the region limit?
dec9	read the EAROM read-back port
decc	not at limit: store the byte
dece	at the limit, xor the read-back against the running checksum
ded1	zero means the region verified
ded8	checksum mismatch: blank the region's RAM bytes back to front
dedb	loop until the whole region is blanked
dee0	record the failure by re-queuing the region bit
dee3	into the pending-work flags
dee8	retire the mode byte -- region done
deee	store the read-back byte through the region walk pointer
def3	fold the byte into the running checksum
def6	store the checksum accumulator
def9	bump the per-region pass counter
defc	bump the region byte cursor
deff	write the exit code to the control port
df03	nonzero exit: return, re-enter later
df05	else loop to drain the next entry
df09	fixed body byte 0xc0 -- the vector-generator opcode for this record class
df0b	jump to the body-write step
df0d	lay the record header word through the draw cursor
df10	fixed body byte 0x20, then fall into the body-write step
df14	store the body byte at the draw-cursor origin
df16	continue into the shared record tail
df19	carry clear: skip the zero-terminator test, use nibble+1
df1b	keep the low nibble -- the glyph selector
df1d	carry set and nibble zero: select terminator glyph 0
df1f	keep the low nibble
df22	index = nibble + 1
df25	double the index -- stroke entries are 16-bit words
df29	read the glyph's first stroke byte from the vector-ROM stroke table
df2c	copy it into the display list at the draw cursor
df2e	read the glyph's second stroke byte
df32	copy it to draw cursor +1
df34	advance the draw cursor two bytes past the word
df39	shift a right, low bit into carry
df3a	keep a's upper nibble
df3c	tag the high byte with the 0xa0 vector-generator opcode
df40	store the tagged high byte at draw cursor +1
df44	rotate x right with a's old bit0 into bit7 -- the low byte
df45	store the low byte at the draw-cursor origin
df48	advance the draw cursor past the word
df4a	take the second payload byte from the current record-header key
df4c	OR the 0x60 header tag into the payload byte
df50	lay the tagged pair into the display list via the shared vector-word writer
df53	load the canonical beam-position header low byte 0x40
df55	load its high byte 0x80 -- the fixed record-opening header word
df57	point at the draw cursor origin (offset 0)
df59	store the word's low byte at draw cursor + y
df5d	store the word's high byte at draw cursor + y+1
df5f	stride for the cursor advance = the offset just consumed
df60	force the carry so the add yields stride + 1
df61	add stride+1 to the draw cursor low byte
df63	store the advanced draw cursor low byte
df65	if no page overflow, done
df67	carry the draw cursor into the next page
df6a	zero the data byte for a blank 0x70-tagged record opener
df6c	OR the 0x70 header tag into the payload byte
df70	lay the tagged word via the shared vector-word writer
df73	stash the record's key/index byte into the header cell (loc_73)
df77	shift the first coordinate left (x2)
df78	if no sign bit shifted out, leave the sign fill zero
df7a	else set an all-ones negative sign fill
df7b	store the first delta's high-byte sign fill (loc_6f)
df7d	shift again -- x4 total
df7e	roll the shifted-out bit into the delta high byte
df80	store the first coordinate's scaled low byte (loc_6e)
df82	second coordinate into a
df83	shift the second coordinate left (x2)
df86	sign check for the second coordinate
df88	set an all-ones negative sign fill
df89	store the second delta's high-byte sign fill (loc_71)
df8b	shift again -- x4 total
df8c	roll the shifted-out bit into the delta high byte
df8e	store the second coordinate's scaled low byte (loc_70)
df90	anchor the coordinate record at the first delta pair (loc_6e)
df92	point at the draw cursor origin
df94	read coordinate source byte (loc_2 + x)
df96	write it at draw cursor +0
df98	read source byte (loc_3 + x)
df9a	clip to five bits
df9d	write at draw cursor +1
df9f	read source byte (loc_0 + x)
dfa2	write at draw cursor +2
dfa4	read the key-folded source byte (loc_1 + x)
dfa6	XOR with the record header key (loc_73)
dfa8	keep only the low five bits re-keyed
dfaa	XOR the key back so the top three bits come from the key
dfac	advance to the record's tail slot
dfad	write the key-folded fourth byte at the tail slot
dfaf	if the slot index has not wrapped to zero, advance the cursor -- else terminate the run
dfb1	seed the carry set for the digit run
dfb3	run counter = length - 1
dfb4	store the run counter (loc_ae)
dfb7	index = run base + count -- the top byte of the run
dfba	working index into x
dfbc	save the working index (loc_af)
dfbe	fetch the packed byte at the run base + x
dfc0	shift the packed byte's high nibble down into the low four bits
dfc5	emit the high nibble as a glyph stroke word
dfc8	reload the run counter
dfca	if not the last byte, keep the propagating carry
dfcc	last byte -- force the carry clear as the run terminator marker
dfcd	restore the working index
dfcf	re-fetch the packed byte for its low nibble
dfd1	emit the low nibble as a glyph stroke word
dfd6	step to the previous byte of the run
dfd7	decrement the run counter
dfd9	loop while the counter stays non-negative
