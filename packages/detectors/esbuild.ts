/* eslint-disable no-console */
import { context } from 'esbuild'
import { setMaxListeners } from 'events'
import { dirname, resolve } from 'path'
import glob from 'tiny-glob/sync.js'
import { fileURLToPath } from 'url'

setMaxListeners(30)

//@ts-ignore
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const watch = process.argv.includes('--watch')

const getPath = (file: string) => resolve(__dirname, file)

const files = glob('./src/**/*.*mts')
	.map((file) =>
		resolve(file)
			.substring(resolve(__dirname, `./src/`).length + 1)
			.replace(/\\/g, '/'),
	)
	.filter((file) => !file.split('/').some((part) => part.startsWith('_')))

const formats = ['esm', 'cjs'] as const

const contexts = await Promise.all(
	files.flatMap((file) =>
		formats.map((format) =>
			context({
				entryPoints: [getPath(`./src/${file}`)],
				bundle: true,
				outfile: getPath(`../../detectors/${file.replace('.mts', `.${format === 'esm' ? 'm' : 'c'}js`)}`),
				platform: 'browser',
				format,
				minify: true,
				sourcemap: watch,
				tsconfig: './tsconfig.json',
			}),
		),
	),
)

for (const ctx of contexts) {
	if (watch) {
		await ctx.watch()
		console.info('👀 watching for changes...')
		process.on('exit', async () => {
			console.info('🙈 process killed')
			await ctx.dispose()
		})
	} else {
		await ctx.rebuild()
		console.info('✅ build complete')
		await ctx.dispose()
	}
}
