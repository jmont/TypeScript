/* @internal */
namespace ts.textChanges {

    function getPos(n: TextRange) {
        return (<any>n)["__pos"];
    }

    function setPos(n: TextRange, pos: number) {
        (<any>n)["__pos"] = pos;
    }

    function getEnd(n: TextRange) {
        return (<any>n)["__end"];
    }

    function setEnd(n: TextRange, end: number) {
        (<any>n)["__end"] = end;
    }

    export interface ChangeOptions {
        readonly hasLeadingNewLine?: boolean;
        readonly hasTrailingNewLine?: boolean;
    }

    interface Change {
        readonly fileName: string;
        readonly range: TextRange;
        readonly node?: Node;
        readonly options?: ChangeOptions;
    }

    export type SourceFileLookup = (fileName: string) => SourceFile | undefined;

    export class ChangeTracker {

        private changes: Change[] = [];

        constructor(
            private readonly sourceFileLookup: SourceFileLookup,
            private readonly newLine: NewLineKind, 
            private readonly rulesProvider: formatting.RulesProvider, 
            private readonly formatOptions: FormatCodeSettings,
            private readonly validator?: (text: NonFormattedText) => void) {
            this.sourceFileLookup;
            this.rulesProvider;
            this.formatOptions;
            this.validator;
        }

        public removeRange(fileName: string, range: TextRange) {
            this.changes.push({ fileName, range });
        }

        public replace(fileName: string, range: TextRange, newNode: Node, options?: ChangeOptions) {
            this.changes.push({ fileName, node: newNode, range, options });
        }

        public replaceRange(fileName: string, ranges: TextRange[], newNode: Node, options?: ChangeOptions) {
            if (!ranges.length) {
                return;
            }
            const range = {
                pos: ranges[0].pos,
                end: ranges[ranges.length - 1].end
            };
            this.changes.push({ fileName, node: newNode, range, options });
        }

        public insertNodeAt(fileName: string, pos: number, node: Node, options?: ChangeOptions) {
            this.changes.push({ fileName, range: { pos, end: pos }, node, options });
        }

        public insertNodeAfter(fileName: string, node: Node, after: Node, options?: ChangeOptions) {
            this.changes.push({ fileName, node, range: { pos: after.end, end: after.end }, options });
        }

        public insertNodeBefore(fileName: string, node: Node, before: Node, options?: ChangeOptions) {
            this.changes.push({ fileName, node, range: { pos: before.pos, end: before.pos }, options });
        }

        public getChanges(): FileTextChanges[] {
            const changesPerFile = createMap<Change[]>();
            // group changes per file
            for (const c of this.changes) {
                let changesInFile = changesPerFile.get(c.fileName);
                if (!changesInFile) {
                    changesPerFile.set(c.fileName, changesInFile = []);
                }
                changesInFile.push(c);
            }
            // convert changes
            const fileChangesList: FileTextChanges[] = [];
            forEachEntry(changesPerFile, (changesInFile, k) => {
                const sourceFile = this.sourceFileLookup(k);
                Debug.assert(sourceFile !== undefined);

                ChangeTracker.normalize(changesInFile);

                const fileTextChanges: FileTextChanges = { fileName: k, textChanges: [] };
                for (const c of changesInFile) {
                    fileTextChanges.textChanges.push({
                        span: this.computeSpan(c, sourceFile),
                        newText: this.computeNewText(c, sourceFile)
                    });
                }
                fileChangesList.push(fileTextChanges);
            })

            return fileChangesList;
        }

        private computeSpan(change: Change, _sourceFile: SourceFile): TextSpan {
            const options = change.options || {};
            if (options.hasLeadingNewLine) {
                
            }
            const token = getTouchingToken(change.range.pos)
            // TODO: skip trailing trivia of a previous node
            throw notImplemented();
        }

        private computeNewText(change: Change, sourceFile: SourceFile): string {
            if (!change.node) {
                // deletion case
                return "";
            }
            const options = change.options || {};
            const nonFormattedText = getNonformattedText(change.node, sourceFile, this.newLine, options.hasLeadingNewLine, options.hasTrailingNewLine);
            if (this.validator) {
                this.validator(nonFormattedText);
            }
            // TODO:
            const initialIndentation = 0;
            const delta = 0;
            return applyFormatting(nonFormattedText, sourceFile, initialIndentation, delta, this.rulesProvider, this.formatOptions)
        }

        private static normalize(changes: Change[]) {
            // order changes by start position
            changes.sort((a, b) => a.range.pos - b.range.pos);
            // verify that end position of the change is less than start position of the next change
            for (let i = 0; i < changes.length - 2; i++) {
                Debug.assert(changes[i].range.end <= changes[i + 1].range.pos);
            }
        }
    }

    export interface NonFormattedText {
        readonly text: string;
        readonly node: Node;
    }

    export function getNonformattedText(node: Node, sourceFile: SourceFile, newLine: NewLineKind, startWithNewLine: boolean, endWithNewLine: boolean): NonFormattedText {
        const writer = new Writer(getNewLineCharacter(newLine), startWithNewLine);
        const printer = createPrinter({ newLine, target: sourceFile.languageVersion }, writer);
        printer.writeNode(EmitHint.Unspecified, node, sourceFile, writer);
        if (endWithNewLine) {
            writer.writeLine();
        }
        return { text: writer.getText(), node: assignPositionsToNode(node) };
    }

    export function applyFormatting(nonFormattedText: NonFormattedText, sourceFile: SourceFile, initialIndentation: number, delta: number, rulesProvider: formatting.RulesProvider, formatSettings: FormatCodeSettings) {
        const lineMap = computeLineStarts(nonFormattedText.text);
        const file: SourceFileLike = {
            text: nonFormattedText.text,
            lineMap,
            getLineAndCharacterOfPosition: pos => computeLineAndCharacterOfPosition(lineMap, pos)
        }
        const changes = formatting.formatNode(nonFormattedText.node, file, sourceFile.languageVariant, initialIndentation, delta, rulesProvider, formatSettings);
        return applyChanges(nonFormattedText.text, changes);

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

    function assignPositionsToNode(node: Node): Node {
        const visited = visitEachChild(node, assignPositionsToNode, nullTransformationContext, assignPositionsToNodeArray);
        // create proxy node for non synthesized nodes
        const newNode = nodeIsSynthesized(visited) 
            ? visited
            : (Proxy.prototype = visited, new (<any>Proxy)());
        newNode.pos = getPos(node);
        newNode.end = getEnd(node);
        return newNode;

        function Proxy() { }
    }

    function assignPositionsToNodeArray(nodes: NodeArray<any>, visitor: Visitor, test?: (node: Node) => boolean, start?: number, count?: number) {
        const visited = visitNodes(nodes, visitor, test, start, count);
        if (!visited) {
            return visited;
        }
        // clone nodearray if necessary
        const nodeArray = visited === nodes ? createNodeArray(visited) : visited;
        nodeArray.pos = getPos(nodes);
        nodeArray.end = getEnd(nodes);
        return nodeArray;
    }

    class Writer implements EmitTextWriter, PrintHandlers {
        private lastNonTriviaPosition = 0;
        private readonly writer: EmitTextWriter;

        public readonly onEmitNode: PrintHandlers["onEmitNode"];
        public readonly onBeforeEmitNodeArray: PrintHandlers["onBeforeEmitNodeArray"];
        public readonly onAfterEmitNodeArray: PrintHandlers["onAfterEmitNodeArray"];

        constructor(newLine: string, private readonly startWithNewLine: boolean) {
            this.writer = createTextWriter(newLine)
            this.onEmitNode = (hint, node, printCallback) => {
                setPos(node, this.lastNonTriviaPosition);
                printCallback(hint, node);
                setEnd(node, this.lastNonTriviaPosition);
            };
            this.onBeforeEmitNodeArray = nodes => {
                if (nodes) {
                    setPos(nodes, this.lastNonTriviaPosition)
                }
            };
            this.onAfterEmitNodeArray = nodes => {
                if (nodes) {
                    setEnd(nodes, this.lastNonTriviaPosition);
                }
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