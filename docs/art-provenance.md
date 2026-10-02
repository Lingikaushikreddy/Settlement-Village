# Artwork provenance

Settlement uses generated original game artwork. The images are concept art and game assets; the screenshots in `docs/media` capture the running application.

## October 2026 resident and journal upgrade

Generated with OpenAI image generation through Codex on 2026-10-02. No third-party source images were supplied. The repository's MIT license covers the distributed project; generated-art provenance is recorded here without claiming exclusivity over similar visual concepts.

| Asset                              | Format                      | Use                                                                                                                 |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `public/game/residents-v3.png`     | 1536 × 1024 transparent PNG | Six equal 512-pixel cells: Mira, Theo, Ada / Finn, Lina, Oscar. Shared full-body map sprites and cropped portraits. |
| `public/game/willowmere-vista.png` | 2172 × 724 PNG              | Decorative illustrated valley in the village journal and field guide. It is not a gameplay screenshot.              |

### Resident atlas prompt

Use case: stylized-concept. Asset type: production game character sprite atlas for Settlement, an original illustrated fantasy village strategy game. Create one transparent PNG atlas containing EXACTLY SIX full-body civilian villagers in a rigorously even 3-column by 2-row grid, each in its own equal square cell; landscape 3:2 canvas. No lines separating cells. All six characters fully contained with generous transparent padding: head at 12% and feet at 89% of their own cell, same scale. Three-quarter isometric camera angle, looking slightly down, characters facing front-right. High-end hand-painted storybook strategy game art, crisp readable silhouettes, softly faceted volumes, expressive friendly faces, rich cloth/leather/tool details, warm daylight, no outlines or photorealism. Top left Mira: adult woman with auburn braid, rust-orange farming tunic, straw hat and small harvest basket. Top center Theo: adult male trader with brown hair, cobalt blue coat, cream shirt and leather shoulder satchel. Top right Ada: adult woman baker with dark curly hair, sage dress, white apron and loaf of bread. Bottom left Finn: adult male waterkeeper with dark skin, ochre-yellow vest, teal scarf and small water vessel. Bottom center Lina: adult female carpenter with dark hair tied back, violet work vest and small wooden mallet/toolbelt. Bottom right Oscar: adult male gardener with grey beard, forest green clothes, rolled sleeves and pruning shears. All stand in relaxed working poses, readable at 70 pixels tall. No soldiers, weapons, armor or franchise characters. No names, text, scenery, backplates, floors, shadows connecting cells, borders, cropped bodies or extra characters. Actual transparent background.

### Valley illustration prompt

Use case: stylized-concept. Asset type: wide illustrated chapter header for an original fantasy strategy game called Settlement. A welcoming, exquisitely hand-painted medieval village in a lush forest valley at warm morning light, seen from a high three-quarter isometric angle. One modest blue-roof stone town hall near the left center, timber barns, red-roof cottages, windmill, neat golden wheat plots, a winding footpath and cool turquoise river on right. The village feels like a small thriving community, not a huge kingdom. Tall pines, layered misty mountain ridges, honey gold sunlit grass, rich jade and evergreen, painterly materials with crisp game concept art detail. Landscape panoramic 3:1 composition, no UI or frame, no text or logo, no soldiers or franchise assets. Strong depth, gentle clear atmosphere, no photographic textures. Final art for journal/banner background with UI text placed outside the image.

## Earlier assets

`public/game/terrain.png` and `public/game/sprites.png` were already part of Settlement's first public release. They remain the painted terrain, buildings, and military sprite atlas. The new civilian atlas replaces the reused military sprites for the six named residents; Rook retains the earlier sprite.

## Integration

The atlas is sliced in CSS without modifying the source bitmap. Full bodies use a 3-column by 2-row background grid; portraits enlarge and crop the same cell, preserving the person's identity across Village, Council and Research.
