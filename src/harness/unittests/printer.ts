/// <reference path="..\..\compiler\emitter.ts" />
/// <reference path="..\..\services\textChangePrinter.ts" />
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

            it("can remove and insert nodes", () => {
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
                    /*typeParameters*/emptyArray,
                    /*parameters*/ emptyArray,
                    /*type*/ createKeywordTypeNode(SyntaxKind.AnyKeyword),
                    /*body */ createBlock(statements)
                );

                const rulesProvider = new formatting.RulesProvider();
                const options = getDefaultFormatOptions();
                options.placeOpenBraceOnNewLineForFunctions = true;
                rulesProvider.ensureUpToDate(options);

                const changes: TextChange[] = []
                // create first change to insert function before M2
                const text1 = textChangePrinter.print(newFunction,
                    sourceFile,
                    /*startWithNewLine*/ true,
                    /*endWithNewLine*/ true,
                    /*initialIndentation*/ 4,
                    /*delta*/ 4,
                    NewLineKind.LineFeed,
                    rulesProvider,
                    options);

                const m2 = findChild("M2", sourceFile);
                // insert c1 before m2
                changes.push({
                    span: createTextSpan(getLineStartPositionForPosition(m2.getStart(sourceFile), sourceFile), 0),
                    newText: text1
                });

                // replace statements with return statement
                const newStatement = createReturn(
                    createCall(
                    /*expression*/ newFunction.name,
                    /*typeArguments*/ emptyArray,
                    /*argumentsArray*/ emptyArray
                    ));
                const text2 = textChangePrinter.print(newStatement,
                    sourceFile,
                    /*startWithNewLine*/ true,
                    /*endWithNewLine*/ false,
                    /*initialIndentation*/ 12,
                    /*delta*/ 0,
                    NewLineKind.LineFeed,
                    rulesProvider,
                    options);
                changes.push({
                    span: createTextSpanFromBounds(getLineStartPositionForPosition(statements[0].getFullStart(), sourceFile), statements[statements.length - 1].getEnd()),
                    newText: text2
                });
                const result = textChangePrinter.applyChanges(sourceFile.text, changes);
                assert(result);
            });
        });
    });
}
