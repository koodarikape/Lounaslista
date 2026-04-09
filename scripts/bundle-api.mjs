/**
 * Cheerio pidetään ulkoisena (Vercel/Lambda -yhteensopivuus).
 * pdf-parse + pdfjs-dist paketoidaan mukaan: pelkkä external rikkoi PDF-tekstin
 * tuotannossa (puuttuvat ali-moduulit / wasm -polut).
 */
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')

for (const name of ['menus', 'menu']) {
  await esbuild.build({
    absWorkingDir: projectRoot,
    entryPoints: [join(projectRoot, 'scripts', 'api-entries', `${name}.ts`)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: join(projectRoot, 'api', `${name}.js`),
    external: ['cheerio', 'cheerio/slim'],
    logLevel: 'info',
  })
}
