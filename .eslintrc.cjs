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
		// 'linebreak-style': [
		// 	'warn',
		// 	'unix',
		// ], // Disabling, git default for Windows development is to keep locally as CRLF, then commit as unix/LF
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
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-empty-function': 'off',

		// Native disables
		'prefer-const': 'off',
		'no-var': 'warn',
		'no-empty': 'off',
		'no-mixed-spaces-and-tabs': 'warn',
		'no-constant-condition': 'warn',
		'no-inner-declarations': 'off',
		'prefer-rest-params': 'off',
		'no-irregular-whitespace': 'warn',
		'no-prototype-builtins': 'off',
		'no-extra-semi': 'off', // Because we're warning on semi in rules above, but we need to use them for IIFEs by habit, which it sometimes considers 'extra'.
		'no-undef': 'off', // Ensures that you do not use variables that are not declared.  TS convers this too. // Disabled because it warns on things like 'process.env'
		'no-global-assign': 'warn', // Disallow assignments to native objects or read-only global variables

		// Handling of block scoping
		'block-scoped-var': 'warn', // enforce the usage of variables within the scope they were defined. This does NOT work to prevent const/let hoisting :(
		'no-shadow': 'warn', // This rule disallows shadowing of variables, i.e., declaring a variable in an inner scope with the same name as a variable in the outer scope. 
		// 'no-use-before-define': 'error', // This rule disallows the use of variables before they are defined. It's particularly useful in preventing issues related to hoisting in JavaScript. // Disabled because a common pattern is using class functions before they are defined.



		
	},
}
