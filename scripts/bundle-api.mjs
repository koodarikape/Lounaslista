/**
 * Vercel-bundler saattaa rikkoa cheerio/pdf-parse -ketjun.
 * Esbuild + packages: 'external' paketoi vain app-koodin; node_modules ladataan
 * Lambda-ajossa (tuo oikeat binäärit).
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
    packages: 'external',
    logLevel: 'info',
  })
}
