// Generate a tray-optimized version of the equalizer logo
// Fewer bars, thicker strokes, filled center, tight crop
import { writeFileSync } from 'fs'

const SIZE = 256 // High-res source for quality downscaling
const CX = SIZE / 2
const CY = SIZE / 2
const BAR_COUNT = 16 // Fewer bars = visible at small sizes
const INNER_R = 56
const STROKE = 18
const col = 'rgb(190,85,20)'

// Generate bars with varying lengths (simulating the processing state)
const lines = []
for (let i = 0; i < BAR_COUNT; i++) {
  const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // Organic-looking bar lengths
  const p = (i / BAR_COUNT) * Math.PI * 2
  const wave =
    Math.sin(p * 3) * 0.3 +
    Math.sin(1.7 + p * 7) * 0.15 +
    Math.sin(0.6 + p * 5) * 0.1 +
    0.55
  const barLen = 20 + wave * 56
  const alpha = Math.min(1, 0.6 + wave * 0.4)

  const x1 = CX + cos * INNER_R
  const y1 = CY + sin * INNER_R
  const x2 = CX + cos * (INNER_R + barLen)
  const y2 = CY + sin * (INNER_R + barLen)

  lines.push(
    `  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(190,85,20,${alpha.toFixed(2)})" stroke-width="${STROKE}" stroke-linecap="round"/>`
  )
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="${CX}" cy="${CY}" r="${INNER_R - 8}" fill="rgba(190,85,20,0.3)"/>
${lines.join('\n')}
</svg>
`

writeFileSync('build/tray-icon.svg', svg)
console.log('Generated build/tray-icon.svg')
