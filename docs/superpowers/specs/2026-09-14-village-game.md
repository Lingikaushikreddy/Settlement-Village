# Settlement: village and battle game

The user rejected the observatory as the primary experience and selected building a village and commanding troops in battles. The approved play loop is build, collect, train, raid, earn rewards, and upgrade.

The main route becomes a full-screen isometric game with original generated terrain and sprite art. A pure local game engine owns resource costs, placement, two concurrent builders, training queues, collection, upgrades, goals, and saved progress. The old observatory remains accessible at /lab. No paid model calls are enabled.

The village contains a town hall, gold mine, lumber mill, farm, barracks and watchtower. Empty tiles support placement and existing buildings support relocation. Costs are validated atomically. Production is capped per building. Timed construction and troop training progress using the simulation clock; offline production is capped at eight hours.

Raids use three authored enemy layouts and deterministic movement, tower targeting, troop damage, range and health. Players select a troop, deploy at a perimeter point, and focus a structure. Deployed troops are spent; undeployed reserves remain. Destruction determines stars and resource rewards, credited exactly once. Raids can be retreated from and time out. This release is single player, locally saved, and not multiplayer matchmaking.

The UI prioritizes the world, with resource counters above, missions on the left, a building action panel on selection, and army/build/battle controls below. Dragging pans the camera; zoom controls and touch layouts are supported. Dialogs have keyboard semantics and animation respects reduced motion.

Verification covers resource conservation, invalid placement, builder capacity, training payment, deterministic combat, troop expenditure, reward idempotency, save validation and the complete browser play loop.
