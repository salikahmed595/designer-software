// Draws the thumbnail illustrations into thumbnails/*.svg.
//   node scripts/make-thumbnails.mjs          writes every generated thumbnail
// Hand-drawn files (stream-overlay, style-anime-cel, style-semi-real) are not generated and are left alone.
import fs from "node:fs";
import path from "node:path";
import { STYLES } from "./thumbs/styles.mjs";
import { ARTWORK } from "./thumbs/artwork.mjs";

const out = path.resolve("thumbnails");
let n = 0;
for (const [id, svg] of Object.entries({ ...ARTWORK, ...STYLES })) {
  const bad = /undefined|NaN|\[object/.exec(svg);
  if (bad) throw new Error(`${id}: output contains "${bad[0]}"`);
  fs.writeFileSync(path.join(out, `${id}.svg`), svg);
  n++;
}
console.log(`wrote ${n} thumbnails`);
