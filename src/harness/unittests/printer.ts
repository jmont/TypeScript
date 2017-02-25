/// <reference path="..\..\compiler\emitter.ts" />
/// <reference path="..\..\services\textChanges.ts" />
/// <reference path="..\harness.ts" />

namespace ts {
    // interface MapConstructor {
    //     new (): Map<any>;
    // }

    // declare const Map: MapConstructor;
    describe("PrinterAPI", () => {
        function makePrintsCorrectly(prefix: string) {
            return function printsCorrectly(name: string, options: PrinterOptions, printCallback: (printer: Printer) => string) {
                it(name, () => {
                    Harness.Baseline.runBaseline(`printerApi/${prefix}.${name}.js`, () =>
                        printCallback(createPrinter({ newLine: NewLineKind.CarriageReturnLineFeed, ...options })));
                });
            }
        }

        describe("printFile", () => {
            const printsCorrectly = makePrintsCorrectly("printsFileCorrectly");
            const sourceFile = createSourceFile("source.ts", `
                interface A<T> {
                    // comment1
                    readonly prop?: T;

                    // comment2
                    method(): void;

                    // comment3
                    new <T>(): A<T>;

                    // comment4
                    <T>(): A<T>;
                }

                // comment5
                type B = number | string | object;
                type C = A<number> & { x: string; }; // comment6

                // comment7
                enum E1 {
                    // comment8
                    first
                }

                const enum E2 {
                    second
                }

                // comment9
                console.log(1 + 2);
            `, ScriptTarget.ES2015);

            printsCorrectly("default", {}, printer => printer.printFile(sourceFile));
            printsCorrectly("removeComments", { removeComments: true }, printer => printer.printFile(sourceFile));
        });

        describe("printBundle", () => {
            const printsCorrectly = makePrintsCorrectly("printsBundleCorrectly");
            const bundle = createBundle([
                createSourceFile("a.ts", `
                    /*! [a.ts] */

                    // comment0
                    const a = 1;
                `, ScriptTarget.ES2015),
                createSourceFile("b.ts", `
                    /*! [b.ts] */

                    // comment1
                    const b = 2;
                `, ScriptTarget.ES2015)
            ]);
            printsCorrectly("default", {}, printer => printer.printBundle(bundle));
            printsCorrectly("removeComments", { removeComments: true }, printer => printer.printBundle(bundle));
        });

        describe("printNode", () => {
            const printsCorrectly = makePrintsCorrectly("printsNodeCorrectly");
            const sourceFile = createSourceFile("source.ts", "", ScriptTarget.ES2015);
            const syntheticNode = createClassDeclaration(
                undefined,
                undefined,
                /*name*/ createIdentifier("C"),
                undefined,
                undefined,
                createNodeArray([
                    createProperty(
                        undefined,
                        createNodeArray([createToken(SyntaxKind.PublicKeyword)]),
                        createIdentifier("prop"),
                        undefined,
                        undefined,
                        undefined
                    )
                ])
            );
            printsCorrectly("class", {}, printer => printer.printNode(EmitHint.Unspecified, syntheticNode, sourceFile));
        });

        describe("print_mixed_content", () => {
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
            function getDefaultFormatOptions() {
                return {
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
            }

            function verifyPositions({text, node}: textChanges.NonFormattedText): void {
                const nodeList = flattedNodes(node);
                const sourceFile = createSourceFile("f.ts", text, ScriptTarget.ES2015);
                const parsedNodeList = flattedNodes(sourceFile.statements[0]);
                Debug.assert(nodeList.length === parsedNodeList.length);
                for (let i = 0; i < nodeList.length; i++) {
                    const left = nodeList[i];
                    const right = parsedNodeList[i];
                    Debug.assert(left.pos === right.pos);
                    Debug.assert(left.end === right.end);
                }

                function flattedNodes(n: Node) {
                    const data: (Node | NodeArray<any>)[] = [];
                    walk(n);
                    return data;

                    function walk(n: Node | Node[]): void {
                        data.push(<any>n);
                        return isArray(n) ? forEach(n, walk) : forEachChild(n, walk, walk);
                    }
                }
            }

            // function printNodeAndVerifyContent(node: Node, sourceFile: SourceFile, newLine: NewLineKind, startWithNewLine: boolean, endWithNewLine: boolean, initialIndentation: number, delta: number, rulesProvider: formatting.RulesProvider, formatSettings: FormatCodeSettings) {
            //     const nonFormattedText = textChanges.getNonformattedText(node, sourceFile, newLine, startWithNewLine, endWithNewLine);
            //     verifyPositions(nonFormattedText);
            //     return textChanges.applyFormatting(nonFormattedText, sourceFile, initialIndentation, delta, rulesProvider, formatSettings);
            // }

            it("can remove and insert nodes", () => {
                Harness.Baseline.runBaseline("printer/removeAndInsertNodes.js", () => {
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
                    const sourceFile = createSourceFile("source.ts", text, ScriptTarget.ES2015);
                    const rulesProvider = new formatting.RulesProvider();
                    const options = getDefaultFormatOptions();
                    options.placeOpenBraceOnNewLineForFunctions = true;
                    rulesProvider.ensureUpToDate(options);

                    const changeTracker = new textChanges.ChangeTracker(_ => sourceFile, NewLineKind.LineFeed, rulesProvider, options, /*validator*/ verifyPositions);
                    debugger
                    const f = <FunctionDeclaration>findChild("foo", sourceFile);
                    assert(f);
                    // select all but first statements
                    const statements = (<Block>f.body).statements.slice(1);
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

                    changeTracker.insertNodeBefore(sourceFile.fileName, newFunction, /*before*/findChild("M2", sourceFile), { hasTrailingNewLine: true });

                    // const changes: TextChange[] = []
                    // // create first change to insert function before M2
                    // const text1 = printNodeAndVerifyContent(newFunction,
                    //     sourceFile,
                    //     NewLineKind.LineFeed,
                    //     /*startWithNewLine*/ true,
                    //     /*endWithNewLine*/ true,
                    //     /*initialIndentation*/ 4,
                    //     /*delta*/ 0,
                    //     rulesProvider,
                    //     options);

                    // const m2 = findChild("M2", sourceFile);
                    // // insert c1 before m2
                    // changes.push({
                    //     span: createTextSpan(getLineStartPositionForPosition(m2.getStart(sourceFile), sourceFile), 0),
                    //     newText: text1
                    // });

                    // replace statements with return statement
                    const newStatement = createReturn(
                        createCall(
                        /*expression*/ newFunction.name,
                        /*typeArguments*/ undefined,
                        /*argumentsArray*/ emptyArray
                        ));
                    changeTracker.replaceRange(sourceFile.fileName, statements, newStatement);

                    // const text2 = printNodeAndVerifyContent(newStatement,
                    //     sourceFile,
                    //     NewLineKind.LineFeed,
                    //     /*startWithNewLine*/ true,
                    //     /*endWithNewLine*/ false,
                    //     /*initialIndentation*/ 12,
                    //     /*delta*/ 0,
                    //     rulesProvider,
                    //     options);
                    // changes.push({
                    //     span: createTextSpanFromBounds(getLineStartPositionForPosition(statements[0].jsDoc[0].pos, sourceFile), statements[statements.length - 1].getEnd()),
                    //     newText: text2
                    // });
                    const changes = changeTracker.getChanges();
                    assert.equal(changes.length, 1);
                    assert.equal(changes[0].fileName, sourceFile.fileName);

                    return textChanges.applyChanges(sourceFile.text, changes[0].textChanges);
                });
            });
        });
    });
}
