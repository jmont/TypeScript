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
        const writer = createWriter();
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

        function createWriter(): EmitTextWriter & PrintHandlers {
            let lastNonTriviaPosition = 0;
            const writer: EmitTextWriter & PrintHandlers = createTextWriter(getNewLineCharacter(newLine));
            const originalWrite = writer.write;
            const originalWriteTextOfNode = writer.writeTextOfNode;
            const originalRawWrite = writer.rawWrite;
            const originalWriteLiteral = writer.writeLiteral;
            writer.write = function(s) {
                originalWrite.call(writer, s);
                if (!isTrivia(s)) {
                    lastNonTriviaPosition = writer.getTextPos();
                }
            }
            writer.writeTextOfNode = function(text, node) {
                originalWriteTextOfNode.call(writer, text, node);
                lastNonTriviaPosition = writer.getTextPos();
            }
            writer.rawWrite = function(s) {
                originalRawWrite.call(writer, s);
                if (!isTrivia(s)) {
                    lastNonTriviaPosition = writer.getTextPos();
                }
            }
            writer.writeLiteral = function(l) {
                originalWriteLiteral.call(writer, l);
                if (!isTrivia(l)) {
                    lastNonTriviaPosition = writer.getTextPos();
                }
            }
            writer.onEmitNode = function(hint, node, printCallback) {
                setPos(node, lastNonTriviaPosition);
                printCallback(hint, node);
                setEnd(node, lastNonTriviaPosition);
            }
            return writer;
        }
    }

    function isTrivia(s: string) {
        return skipTrivia(s, 0) === s.length;
    }  
}