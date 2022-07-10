// Based on MIT licensed https://github.com/mysticatea/eslint-plugin/blob/master/lib/rules/no-this-in-static.js

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------
/* eslint-env node */ // Allow node-style module 
module.exports = {

	rules: {
		'no-this-in-static': {
			create(context) {
				const sourceCode = context.getSourceCode()
				let funcInfo = null
		
				/**
				 * Checks whether the given function node is a static method or not.
				 *
				 * @param {ASTNode} node - The function node to check.
				 * @returns {boolean} `true` if the node is a static method.
				 */
				function isStaticMethod(node) {
					return (
						node.type === 'FunctionExpression' &&
						node.parent.type === 'MethodDefinition' &&
						node.parent.static === true
					)
				}
		
				/**
				 * Updates the stack of function information.
				 *
				 * @param {ASTNode} node - The function node to make information.
				 * @returns {void}
				 */
				function enterFunction(node) {
					funcInfo = {
						upper: funcInfo,
						static: isStaticMethod(node),
					}
				}
		
				/**
				 * Updates the stack of function information.
				 *
				 * @returns {void}
				 */
				function exitFunction() {
					funcInfo = funcInfo.upper
				}
		
				/**
				 * Reports the `this`/`super` node if this is inside of a static method.
				 *
				 * @param {ASTNode} node - The node to report.
				 * @returns {void}
				 */
				function reportIfStatic(node) {
					if (funcInfo != null && funcInfo.static) {
						context.report({
							node,
							loc: node.loc,
							message: 'Unexpected \'{{type}}\'.  Unsafe to use in static methods in case of refactor.',
							data: { type: sourceCode.getText(node) },
						})
					}
				}
		
				return {
					FunctionDeclaration: enterFunction,
					FunctionExpression: enterFunction,
					'FunctionDeclaration:exit': exitFunction,
					'FunctionExpression:exit': exitFunction,
					ThisExpression: reportIfStatic,
					Super: reportIfStatic,
				}
			},
		}
	},
	
}