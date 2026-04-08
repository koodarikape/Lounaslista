import type { VercelRequest, VercelResponse } from '@vercel/node'
import { load } from 'cheerio'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const $ = load('<div id="x">ok</div>')
  res
    .status(200)
    .setHeader('Content-Type', 'application/json')
    .end(JSON.stringify({ cheerio: $('#x').text() }))
}
