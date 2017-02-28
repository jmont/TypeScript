/// <reference path="..\..\compiler\emitter.ts" />
/// <reference path="..\..\services\textChanges.ts" />
/// <reference path="..\harness.ts" />

namespace ts {
    describe("textChanges", () => {
        function findChild(name: string, n: Node) {
            return find(n);

            function find(node: Node): Node {
                if (isDeclaration(node) && isIdentifier(node.name) && node.name.text === name) {
                    return node
                }
                else {
                    return forEachChild(node, find);
                }
            }
        }

        function getRuleProviderAndOptions(action?: (opts: FormatCodeSettings) => void) {
            const options = {
                indentSize: 4,
                tabSize: 4,
                newLineCharacter: "\n",
                convertTabsToSpaces: true,
                indentStyle: ts.IndentStyle.Smart,
                insertSpaceAfterConstructor: false,
                insertSpaceAfterCommaDelimiter: true,
                insertSpaceAfterSemicolonInForStatements: true,
                insertSpaceBeforeAndAfterBinaryOperators: true,
                insertSpaceAfterKeywordsInControlFlowStatements: true,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
                insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
                insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
                insertSpaceBeforeFunctionParenthesis: false,
                placeOpenBraceOnNewLineForFunctions: false,
                placeOpenBraceOnNewLineForControlBlocks: false,
            };
            if (action) {
                action(options);
            }
            const rulesProvider = new formatting.RulesProvider();
            rulesProvider.ensureUpToDate(options);
            return { rulesProvider, options };
        }

        function verifyPositions({ text, node }: textChanges.NonFormattedText): void {
            const nodeList = flattenNodes(node);
            const sourceFile = createSourceFile("f.ts", text, ScriptTarget.ES2015);
            const parsedNodeList = flattenNodes(sourceFile.statements[0]);
            Debug.assert(nodeList.length === parsedNodeList.length);
            for (let i = 0; i < nodeList.length; i++) {
                const left = nodeList[i];
                const right = parsedNodeList[i];
                Debug.assert(left.pos === right.pos);
                Debug.assert(left.end === right.end);
            }

            function flattenNodes(n: Node) {
                const data: (Node | NodeArray<any>)[] = [];
                walk(n);
                return data;

                function walk(n: Node | Node[]): void {
                    data.push(<any>n);
                    return isArray(n) ? forEach(n, walk) : forEachChild(n, walk, walk);
                }
            }
        }

        function runSingleFileTest(caption: string, setupFormatOptions: (opts: FormatCodeSettings) => void, text: string, validateNodes: boolean, testBlock: (sourceFile: SourceFile, changeTracker: textChanges.ChangeTracker) => void) {
            it(caption, () => {
                Harness.Baseline.runBaseline(`textChanges/${caption}.js`, () => {
                    const sourceFile = createSourceFile("source.ts", text, ScriptTarget.ES2015, /*setParentNodes*/ true);
                    const { rulesProvider, options } = getRuleProviderAndOptions(setupFormatOptions);
                    const changeTracker = new textChanges.ChangeTracker(_ => sourceFile, NewLineKind.CarriageReturnLineFeed, rulesProvider, options, validateNodes ? verifyPositions : undefined);
                    testBlock(sourceFile, changeTracker);
                    const changes = changeTracker.getChanges();
                    assert.equal(changes.length, 1);
                    assert.equal(changes[0].fileName, sourceFile.fileName);
                    const modified = textChanges.applyChanges(sourceFile.text, changes[0].textChanges);
                    return `===ORIGINAL===\r\n${text}\r\n===MODIFIED===\r\n${modified}`;
                });
            });
        }

        {
            const text = `
namespace M 
{
    namespace M2 
    {
        function foo() {
            // comment 1
            const x = 1;

            /**
             * comment 2 line 1
             * comment 2 line 2
             */
            function f() {
                return 100;
            }
            const y = 2; // comment 3
            return 1;
        }
    }
}`;
            runSingleFileTest("extractMethodLike", opts => opts.placeOpenBraceOnNewLineForFunctions = true, text, /*validateNodes*/ true, (sourceFile, changeTracker) => {
                const statements = (<Block>(<FunctionDeclaration>findChild("foo", sourceFile)).body).statements.slice(1);
                const newFunction = createFunctionDeclaration(
                        /*decorators*/ undefined,
                        /*modifiers*/ undefined,
                        /*asteriskToken*/ undefined,
                        /*name*/ "bar",
                        /*typeParameters*/ undefined,
                        /*parameters*/ emptyArray,
                        /*type*/ createKeywordTypeNode(SyntaxKind.AnyKeyword),
                        /*body */ createBlock(statements)
                );

                changeTracker.insertNodeBefore(sourceFile, /*before*/findChild("M2", sourceFile), newFunction, { insertTrailingNewLine: true });

                // replace statements with return statement
                const newStatement = createReturn(
                    createCall(
                        /*expression*/ newFunction.name,
                        /*typeArguments*/ undefined,
                        /*argumentsArray*/ emptyArray
                    ));
                changeTracker.replaceNodeRange(sourceFile, statements[0], lastOrUndefined(statements), newStatement);
            });
        }
        {
            const text = `
function foo() {
    return 1;
}

function bar() {
    return 2;
}
`;
            runSingleFileTest("deleteRange1", noop, text, /*validateNodes*/ false, (sourceFile, changeTracker) => {
                changeTracker.deleteRange(sourceFile, { pos: text.indexOf("function foo"), end: text.indexOf("function bar") });
            });
        }
        {
            const text = `
var x = 1; // some comment - 1
/**
 * comment 2
 */
var y = 2; // comment 3
var z = 3; // comment 4
`;
            function findVariableStatementContainingY(sourceFile: SourceFile) {
                const varDecl = findChild("y", sourceFile);
                assert.equal(varDecl.kind, SyntaxKind.VariableDeclaration);
                const varStatement = varDecl.parent.parent;
                assert.equal(varStatement.kind, SyntaxKind.VariableStatement);
                return varStatement;
            }

            runSingleFileTest("deleteNode1", noop, text, /*validateNodes*/ false, (sourceFile, changeTracker) => {
                // delete raw node range
                changeTracker.deleteNode(sourceFile, findVariableStatementContainingY(sourceFile));
            });
            runSingleFileTest("deleteNode2", noop, text, /*validateNodes*/ false, (sourceFile, changeTracker) => {
                // delete ignoring trailing trivia of preceding node
                changeTracker.deleteNode(sourceFile, findVariableStatementContainingY(sourceFile), { useNonAdjustedStartPosition: true });
            });
            runSingleFileTest("deleteNode3", noop, text, /*validateNodes*/ false, (sourceFile, changeTracker) => {
                // delete ignoring trailing trivia of preceding node
                changeTracker.deleteNode(sourceFile, findVariableStatementContainingY(sourceFile), { useNonAdjustedEndPosition: true });
            });
            runSingleFileTest("deleteNode4", noop, text, /*validateNodes*/ false, (sourceFile, changeTracker) => {
                // delete ignoring trailing trivia of preceding node
                changeTracker.deleteNode(sourceFile, findVariableStatementContainingY(sourceFile), { useNonAdjustedStartPosition: true, useNonAdjustedEndPosition: true });
            });
        }
    });
}