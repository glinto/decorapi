import esbuild from 'esbuild';

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
}
