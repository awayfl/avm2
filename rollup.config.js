var includePaths = require('rollup-plugin-includepaths');
var commonjs = require('rollup-plugin-commonjs');
var nodeResolve = require('rollup-plugin-node-resolve');

module.exports = {
	input: './dist/index.js',
	output: {
		name: 'AwayflAvm1',
		sourcemap: true,
		format: 'umd',
		file: './bundle/awayfl-avm2.umd.js',
		globals: {
			'@awayjs/core': 'AwayjsCore',
			'@awayjs/graphics': 'AwayjsGraphics',
			'@awayjs/scene': 'AwayjsScene',
			'@awayjs/stage': 'AwayjsStage',
			'@awayjs/swf-viewer': 'AwayjsSwfViewer',
		},
	},
	external: [
		'@awayjs/core',
		'@awayjs/graphics',
		'@awayjs/scene',
		'@awayjs/stage',
		'@awayjs/swf-viewer',
	],
	plugins: [
		nodeResolve({
			jsnext: true,
			main: true,
			module: true
		}) ]
};