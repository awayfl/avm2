import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
	input: './dist/index.js',
	output: {
		name: 'AwayflAvm2',
		globals: {
			'@awayfl/swf-loader': 'AwayflSwfLoader',
			'@awayjs/core': 'AwayjsCore',
			'@awayjs/stage': 'AwayjsStage',
			'@awayjs/view': 'AwayjsView',
			'@awayjs/renderer': 'AwayjsRenderer',
			'@awayjs/graphics': 'AwayjsGraphics',
			'@awayjs/materials': 'AwayjsMaterials',
			'@awayjs/scene': 'AwayjsScene'
		},
		sourcemap: true,
		format: 'umd',
		file: './bundle/awayfl-avm2.umd.js'
	},
	external: [
		'@awayfl/swf-loader',
		'@awayjs/core',
		'@awayjs/stage',
		'@awayjs/view',
		'@awayjs/renderer',
		'@awayjs/graphics',
		'@awayjs/materials',
		'@awayjs/scene'
	],
	plugins: [
		nodeResolve(),
		commonjs(),
		terser(),
	]
};