namespace ts.treeFormatter {

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

    export function format(node: Node, sourceFile: SourceFile, rulesProvider: formatting.RulesProvider, formatSettings: FormatCodeSettings, newLine: NewLineKind): string {
        const writer = new TextWriter();
        const printer = createPrinter({ newLine, target: sourceFile.languageVersion }, {
            onEmitNode(hint, node, printCallback) {
                setPos(node, writer.getPos());
                printCallback(hint, node);
                setEnd(node, writer.getPos());
            }
        });
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

    class TextWriter implements EmitTextWriter {

        getPos(): number {
            throw new Error('Method not implemented.');
        }

        write(s: string): void {
            throw new Error('Method not implemented.');
        }
        writeTextOfNode(text: string, node: Node): void {
            throw new Error('Method not implemented.');
        }
        writeLine(): void {
            throw new Error('Method not implemented.');
        }
        increaseIndent(): void {
            throw new Error('Method not implemented.');
        }
        decreaseIndent(): void {
            throw new Error('Method not implemented.');
        }
        getText(): string {
            throw new Error('Method not implemented.');
        }
        rawWrite(s: string): void {
            throw new Error('Method not implemented.');
        }
        writeLiteral(s: string): void {
            throw new Error('Method not implemented.');
        }
        getTextPos(): number {
            throw new Error('Method not implemented.');
        }
        getLine(): number {
            throw new Error('Method not implemented.');
        }
        getColumn(): number {
            throw new Error('Method not implemented.');
        }
        getIndent(): number {
            throw new Error('Method not implemented.');
        }
        isAtStartOfLine(): boolean {
            throw new Error('Method not implemented.');
        }
        reset(): void {
            throw new Error('Method not implemented.');
        }
    }
}