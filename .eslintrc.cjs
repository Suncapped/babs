/* eslint-env node */ // Allow node-style module 
module.exports = {
	'env': {
		'browser': true,
		'es2021': true,
	},
	'extends': [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'ecmaVersion': 'latest',
		'sourceType': 'module',
	},
	'plugins': [
		'@typescript-eslint',
		'@suncapped',
	],
	'rules': {
		'indent': [
			'warn',
			'tab',
		],
		'linebreak-style': [
			'warn',
			'unix',
		],
		'quotes': [
			'warn',
			'single',
			{
				'allowTemplateLiterals': true,
				'avoidEscape': true,
			}
		],
		'semi': [
			'warn',
			'never',
		],
		
		// Custom disables
		'@suncapped/no-this-in-static': 'warn', // `this.` in a class static function led to a difficult bug after I switched the class to non-static.

		// Typescript disables
		'@typescript-eslint/no-inferrable-types': 'off',
		'@typescript-eslint/no-unused-vars': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-empty-function': 'off',

		// Native disables
		'prefer-const': 'off',
		'no-var': 'warn',
		'no-empty': 'off',
		'no-mixed-spaces-and-tabs': 'warn',
		'no-constant-condition': 'warn',
		
	},
}
