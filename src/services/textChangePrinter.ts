/* @internal */
namespace ts.textChangePrinter {

    function getPos(n: Node) {
        return (<any>n)["__pos"];
    }

    function setPos(n: Node, pos: number) {
        (<any>n)["__pos"] = pos;
    }

    function getEnd(n: Node) {
        return (<any>n)["__end"];
    }

    function setEnd(n: Node, end: number) {
        (<any>n)["__end"] = end;
    }

    function checkTrees(s: string, n: Node): void {
        const l1 = flatten(n);
        const f = createSourceFile("f.ts", s, ScriptTarget.ES2015);
        const l2 = flatten(f.statements[0]);
        Debug.assert(l1.length === l2.length);
        for (let i = 0; i < l1.length; i++) {
            const left = l1[i];
            const right = l2[i];
            Debug.assert(left.pos === right.pos);
            Debug.assert(left.end === right.end);
        }


        function flatten(n: Node) {
            const data: (Node | NodeArray<any>)[] = [];
            walk(n);
            return data;
            function walk(n: Node | Node[]) {
                data.push(<any>n);
                if (isArray(n)) {
                    n.forEach(walk);
                }
                else {
                    forEachChild(n, walk, walk);
                }
            }
        }
    }

    export function print(node: Node, sourceFile: SourceFile, startWithNewLine: boolean, endWithNewLine: boolean, initialIndentation: number, delta: number, newLine: NewLineKind, rulesProvider: formatting.RulesProvider, formatSettings: FormatCodeSettings): string {
        const writer = new Writer(getNewLineCharacter(newLine), startWithNewLine);
        const printer = createPrinter({ newLine, target: sourceFile.languageVersion }, writer);
        printer.writeNode(EmitHint.Unspecified, node, sourceFile, writer);
        if (endWithNewLine) {
            writer.writeLine();
        }

        const nonFormattedText = writer.getText();
        const lineMap = computeLineStarts(nonFormattedText);
        const file: SourceFileLike = {
            text: nonFormattedText,
            lineMap,
            getLineAndCharacterOfPosition: pos => computeLineAndCharacterOfPosition(lineMap, pos)
        }
        const copy = clone(node);
        const c1 = createSourceFile("t.ts", nonFormattedText, ScriptTarget.ES2015);
        const cc1 = formatting.formatNode(c1.statements[0], file, sourceFile.languageVariant, initialIndentation, delta, rulesProvider, formatSettings);
        const rr1 = applyChanges(nonFormattedText, cc1);
        Debug.assert(!!rr1);

        checkTrees(nonFormattedText, copy);



        const changes = formatting.formatNode(copy, file, sourceFile.languageVariant, initialIndentation, delta, rulesProvider, formatSettings);
        return applyChanges(nonFormattedText, changes);
    }

    export function applyChanges(text: string, changes: TextChange[]): string {
        for (let i = changes.length - 1; i >= 0; i--) {
            const change = changes[i];
            text = `${text.substring(0, change.span.start)}${change.newText}${text.substring(textSpanEnd(change.span))}`
        }
        return text;
    }

    function isTrivia(s: string) {
        return skipTrivia(s, 0) === s.length;
    }

    const nullTransformationContext: TransformationContext = {
        enableEmitNotification: noop,
        enableSubstitution: noop,
        endLexicalEnvironment: () => undefined,
        getCompilerOptions: notImplemented,
        getEmitHost: notImplemented,
        getEmitResolver: notImplemented,
        hoistFunctionDeclaration: noop,
        hoistVariableDeclaration: noop,
        isEmitNotificationEnabled: notImplemented,
        isSubstitutionEnabled: notImplemented,
        onEmitNode: noop,
        onSubstituteNode: notImplemented,
        readEmitHelpers: notImplemented,
        requestEmitHelper: noop,
        resumeLexicalEnvironment: noop,
        startLexicalEnvironment: noop,
        suspendLexicalEnvironment: noop
    }

    function clone(n: Node): Node {
        function C() { }
        C.prototype = visitEachChild(n, clone, nullTransformationContext);
        const newNode = new (<any>C)();
        newNode.pos = getPos(n);
        newNode.end = getEnd(n);
        return newNode;
    }

    class Writer implements EmitTextWriter, PrintHandlers {
        private lastNonTriviaPosition = 0;
        private readonly writer: EmitTextWriter;

        public readonly onEmitNode: PrintHandlers["onEmitNode"];

        constructor(newLine: string, private readonly startWithNewLine: boolean) {
            this.writer = createTextWriter(newLine)
            this.onEmitNode = (hint, node, printCallback) => {
                setPos(node, this.lastNonTriviaPosition);
                printCallback(hint, node);
                setEnd(node, this.lastNonTriviaPosition);
            };
        }

        private setLastNonTriviaPosition(s: string, force: boolean) {
            if (force || !isTrivia(s)) {
                this.lastNonTriviaPosition = this.writer.getTextPos();
                let i = 0;
                while (isWhiteSpace(s.charCodeAt(s.length - i - 1))) {
                    i++;
                }
                // trim trailing whitespaces
                this.lastNonTriviaPosition -= i;
            }
        }

        write(s: string): void {
            this.writer.write(s);
            this.setLastNonTriviaPosition(s, /*force*/ false);
        }
        writeTextOfNode(text: string, node: Node): void {
            this.writer.writeTextOfNode(text, node);
        }
        writeLine(): void {
            this.writer.writeLine();
        }
        increaseIndent(): void {
            this.writer.increaseIndent();
        }
        decreaseIndent(): void {
            this.writer.decreaseIndent();
        }
        getText(): string {
            return this.writer.getText();
        }
        rawWrite(s: string): void {
            this.writer.rawWrite(s);
            this.setLastNonTriviaPosition(s, /*force*/ false);
        }
        writeLiteral(s: string): void {
            this.writer.writeLiteral(s);
            this.setLastNonTriviaPosition(s, /*force*/ true);
        }
        getTextPos(): number {
            return this.writer.getTextPos();
        }
        getLine(): number {
            return this.writer.getLine();
        }
        getColumn(): number {
            return this.writer.getColumn();
        }
        getIndent(): number {
            return this.writer.getIndent();
        }
        isAtStartOfLine(): boolean {
            return this.writer.isAtStartOfLine();
        }
        reset(): void {
            this.writer.reset();
            this.lastNonTriviaPosition = 0;
            if (this.startWithNewLine) {
                this.writeLine();
            }
        }
    }
}