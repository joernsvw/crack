// Erzeugt die App-Icons aus einer SVG-Vorlage. Nur noetig, wenn sich das Icon aendert.
// sharp ist bewusst keine Projekt-Abhaengigkeit: SHARP_PATH=<pfad>/node_modules/sharp node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(process.cwd(), 'x.js'))
const sharp = require(process.env.SHARP_PATH ?? 'sharp')

// Gabel und Loeffel auf Salbeigruen. "scale" laesst beim maskierbaren Icon Rand fuer die Android-Maske.
const svg = (scale, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#5b7f64"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="#f6f7f3" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M136 112v92c0 30 18 52 40 52s40-22 40-52v-92M176 112v288"/>
    <ellipse cx="336" cy="172" rx="48" ry="66"/>
    <path d="M336 238v162"/>
  </g>
</svg>`

writeFileSync('public/favicon.svg', svg(1, 112))

const targets = [
  ['public/icon-192.png', 192, svg(1, 112)],
  ['public/icon-512.png', 512, svg(1, 112)],
  ['public/icon-maskable-512.png', 512, svg(0.72, 0)],
  ['public/apple-touch-icon.png', 180, svg(0.88, 0)],
]
for (const [file, size, source] of targets) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file)
}
