/// <reference path="..\..\compiler\emitter.ts" />
/// <reference path="..\harness.ts" />

namespace ts {
    interface MapConstructor {
        new (): Map<any>;
    }

    declare const Map: MapConstructor;
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
            const sourceFile = createSourceFile("source.ts",
            `
module M {
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
}
            `, ScriptTarget.ES2015);
            it("runs", () => {
                debugger
                const statements = (<ModuleBlock>(<ModuleDeclaration>sourceFile.statements[0]).body).statements;
                const synthesizedNode = createModuleDeclaration(
                    undefined,
                    undefined,
                    createIdentifier("M2"),
                    createModuleBlock(statements));
                const starts = new Map();
                const ends = new Map();
                const textWriter = createTextWriter("\n");
                const printer = createPrinter({}, {
                    onEmitNode(hint, node, printCallback) {
                        starts.set(<any>node, textWriter.getTextPos());
                        printCallback(hint, node);
                        ends.set(<any>node, textWriter.getTextPos());
                    }
                });
                printer.writeNode(EmitHint.Unspecified, synthesizedNode, sourceFile, textWriter);
                const r = textWriter.getText();
                const keys = starts.keys();
                while (true) {
                    const { value, done } = keys.next();
                    if (done) {
                        break;
                    }
                    const s = starts.get(value);
                    const e = ends.get(value);
                    console.log(`${s} - ${e}: ${ r.substring(s, e) }`);
                }
            });
        });
    });
}
