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
			'@awayfl/swf-loader': 'AwayflSwfLoader',
			'@awayjs/core': 'AwayjsCore',
			'@awayjs/graphics': 'AwayjsGraphics',
			'@awayjs/scene': 'AwayjsScene',
			'@awayjs/stage': 'AwayjsStage',
		},
	},
	external: [
		'@awayfl/swf-loader',
		'@awayjs/core',
		'@awayjs/graphics',
		'@awayjs/scene',
		'@awayjs/stage',
	],
	plugins: [
		nodeResolve({
			jsnext: true,
			main: true,
			module: true
		}),
		commonjs({
			namedExports: {
				'blocks': './node_modules/xregexp/tools/output/blocks.js'
			}
		})
	]
};