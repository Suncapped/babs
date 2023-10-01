/**
 * The following section of the code is adapted from https://github.com/mysticatea/eslint-plugin/blob/master/lib/rules/no-this-in-static.js, under the MIT License.
 * Copyright (c) 2015 Toru Nagashima
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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