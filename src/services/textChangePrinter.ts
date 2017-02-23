namespace ts.textChangePrinter {

    // function getPos(n: Node) {
    //     return (<any>n)["__pos"];
    // }

    function setPos(n: Node, pos: number) {
        (<any>n)["__pos"] = pos;
    }

    // function getEnd(n: Node) {
    //     return (<any>n)["__end"];
    // }

    function setEnd(n: Node, end: number) {
        (<any>n)["__end"] = end;
    }

    export function print(node: Node, sourceFile: SourceFile, startOnNewLine: boolean, _initialIndentation: number, newLine: NewLineKind, rulesProvider: formatting.RulesProvider, formatSettings: FormatCodeSettings): string {
        const writer = new Writer(getNewLineCharacter(newLine));
        if (startOnNewLine) {
            writer.writeLine();
        }
        const printer = createPrinter({ newLine, target: sourceFile.languageVersion }, writer);
        printer.writeNode(EmitHint.Unspecified, node, sourceFile, writer);

        const nonFormattedText = writer.getText();
        // TODO: set initial indentation
        let formattedText = nonFormattedText;
        const changes = formatting.formatNode(node, nonFormattedText, rulesProvider, formatSettings);
        for (let i = changes.length - 1; i >= 0; i--) {
            const change = changes[i];
            formattedText = `${formattedText.substring(0, change.span.start)}${change.newText}${formattedText.substring(textSpanEnd(change.span))}`
        }
        return formattedText;
    }

    function isTrivia(s: string) {
        return skipTrivia(s, 0) === s.length;
    }

    class Writer implements EmitTextWriter, PrintHandlers {
        private lastNonTriviaPosition = 0;
        private readonly writer: EmitTextWriter;

        constructor(newLine: string) {
            this.writer = createTextWriter(newLine)
        }

        private setLastNonTriviaPosition(s: string, force: boolean) {
            if (force && !isTrivia(s)) {
                this.lastNonTriviaPosition = this.writer.getTextPos();
            }
        }

        onEmitNode(hint: EmitHint, node: Node, printCallback: (hint: EmitHint, node: Node) => void) {
            setPos(node, this.lastNonTriviaPosition);
            printCallback(hint, node);
            setEnd(node, this.lastNonTriviaPosition);
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
            this.setLastNonTriviaPosition(s,/*force*/ true);
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
        }
    }
}