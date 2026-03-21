import esbuild from 'esbuild';
import { copyFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');

const shared = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	sourcemap: true,
	packages: 'external',
};

if (watch) {
	const cjsCtx = await esbuild.context({
		...shared,
		format: 'cjs',
		outfile: 'dist/index.js',
	});

	const esmCtx = await esbuild.context({
		...shared,
		format: 'esm',
		outfile: 'dist/index.mjs',
	});

	await Promise.all([cjsCtx.watch(), esmCtx.watch()]);
	console.log('Watching for changes…');
} else {
	await Promise.all([
		esbuild.build({
			...shared,
			format: 'cjs',
			outfile: 'dist/index.js',
		}),
		esbuild.build({
			...shared,
			format: 'esm',
			outfile: 'dist/index.mjs',
		}),
	]);
	console.log('Build complete.');
	// Copy the CJS declaration file as the ESM counterpart so that TypeScript
	// (moduleResolution: bundler/node16/nodenext) can resolve types when
	// importing from dist/index.mjs.
	copyFileSync('dist/index.d.ts', 'dist/index.d.mts');
}
