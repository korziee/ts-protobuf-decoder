// Define lexical grammer, will be used in the lexer

type TokenCollection = {
  keyword: {
    type: "keyword";
    value: ("syntax" | "message") | ("int32" | "bool" | "string");
  };
  operator: {
    type: "operator";
    value: "=";
  };
  deliminator: {
    type: "deliminator";
    value: "{" | "}" | ";";
  };
  identifier: {
    type: "identifier";
    value: string;
  };
  "integer-literal": {
    type: "integer-literal";
    value: number;
  };
  "string-literal": {
    type: "string-literal";
    value: string;
  };
  eof: {
    type: "eof";
  };
};

type Token = TokenCollection[keyof TokenCollection];

type ASTCollection = {
  syntax: {
    type: "syntax";
    value: "proto3";
  };
  message: {
    type: "message";
    name: string;
    body: Array<ASTCollection["message"] | ASTCollection["field"]>;
  };
  field: {
    type: "field";
    fieldType: "string" | "int32" | "bool";
    name: string;
    number: number;
  };
};

export type AST = ASTCollection[keyof ASTCollection];

export class Reader {
  private originalSource: string;

  constructor(private source: string) {
    this.originalSource = source;
  }

  public consume(characters: number = 1): string {
    const result = this.source.slice(0, characters);
    this.source = this.source.substring(characters);

    return result;
  }

  public peek(characters: number = 1): string {
    const result = this.source.slice(0, characters);

    return result;
  }

  public eof(): boolean {
    return this.peek() === "";
  }

  public getCurrentSource(): string {
    return this.source;
  }

  // bit of a hack, but essentially allows lexer to "undo" changes when the peek method actually consumes from the character stream.
  public setCurrentSource(newSource: string) {
    this.source = newSource;
  }
}

export class Lexer {
  private reader: Reader;

  constructor(private proto: string) {
    this.reader = new Reader(this.proto.trim().replaceAll("\n", ""));
  }

  private isKeyword(
    value: string
  ): value is TokenCollection["keyword"]["value"] {
    return ["syntax", "message", "int32", "bool", "string"].includes(value);
  }

  private isDeliminator(
    value: string
  ): value is TokenCollection["deliminator"]["value"] {
    return ["{", "}", ";"].includes(value);
  }

  private isOperator(
    value: string
  ): value is TokenCollection["operator"]["value"] {
    return ["="].includes(value);
  }

  private isStringLiteral(value: string): boolean {
    return value.at(0) === '"';
  }

  private isIntegerLiteral(value: string): boolean {
    return /^\d+$/.test(value);
  }

  private isWhitespace(value: string): boolean {
    return /\s/g.test(value);
  }

  private isIdentifier(value: string): boolean {
    // starts with a letter, and contains only letters, digits, or underscores in the entire string.
    return /^[a-z][a-z0-9_]*$/i.test(value);
  }

  private getToken(value: string): Token {
    if (this.isKeyword(value)) {
      return { type: "keyword", value };
    }

    if (this.isDeliminator(value)) {
      return { type: "deliminator", value };
    }

    if (this.isIntegerLiteral(value)) {
      return { type: "integer-literal", value: parseInt(value, 10) };
    }

    if (this.isStringLiteral(value)) {
      return { type: "string-literal", value: value.replaceAll('"', "") };
    }

    if (this.isOperator(value)) {
      return { type: "operator", value };
    }

    if (this.isIdentifier(value)) {
      return { type: "identifier", value };
    }

    throw new Error(
      `Could not ascertain token type from contents of: "${value}"`
    );
  }

  public peek(tokens: number): Token[];
  public peek(tokens: 1): Token;
  public peek(tokens?: never): Token;
  public peek(tokens: number = 1): Token | Token[] {
    const sourceCopy = this.reader.getCurrentSource();

    const res = this.consume(tokens);

    this.reader.setCurrentSource(sourceCopy);

    return res;
  }

  public consume(tokens: number): Token[];
  public consume(tokens: 1): Token;
  public consume(tokens?: never): Token;
  public consume(tokens: number = 1): Token | Token[] {
    const tokes: Token[] = [];

    for (let i = 0; i < tokens; i += 1) {
      let chars = "";

      while (this.isWhitespace(this.reader.peek())) {
        this.reader.consume();
      }

      if (this.reader.eof()) {
        // we're done here.
        tokes.push({
          type: "eof",
        });
        break;
      }

      if (this.isDeliminator(this.reader.peek())) {
        chars += this.reader.consume();
        tokes.push(this.getToken(chars));
        // we can stop here safely.
        continue;
      }

      // consume chars
      while (
        !this.isWhitespace(this.reader.peek()) &&
        !this.isDeliminator(this.reader.peek()) &&
        !this.reader.eof()
      ) {
        chars += this.reader.consume();
      }

      tokes.push(this.getToken(chars));
    }

    if (tokens === 1) {
      if (tokes.length > 1) {
        throw new Error("expected only one token to be consumed");
      }
      return tokes[0];
    }

    return tokes;
  }
}

export class Parser {
  private lexer: Lexer;

  constructor(private proto: string) {
    this.lexer = new Lexer(this.proto);
  }

  private consumeMessage(): ASTCollection["message"] {
    const [, name, openParen] = this.lexer.consume(3);

    if (name.type !== "identifier") {
      throw new Error("expected identifier after message statement");
    }
    if (!(openParen.type === "deliminator" && openParen.value === "{")) {
      throw new Error("expected left curly after message identifier");
    }

    const ast: ASTCollection["message"] = {
      name: name.value,
      type: "message",
      body: [],
    };

    let infiniteLoopGuard = 1000;

    while (true) {
      if (infiniteLoopGuard === 0) {
        throw new Error(
          "unable to parse message, saw more than 1000 iterations"
        );
      }
      infiniteLoopGuard -= 1;

      const peek = this.lexer.peek();

      // at the end of message
      if (peek.type === "deliminator" && peek.value === "}") {
        // consume delim
        this.lexer.consume();
        break;
      }

      if (peek.type !== "keyword") {
        throw new Error("expected keyword inside message body");
      }

      if (
        peek.value === "bool" ||
        peek.value === "int32" ||
        peek.value === "string"
      ) {
        const res = this.lexer.consume(4);
        this.consumeAndAssertSemiColonDelim();

        if (res[0].type !== "keyword") {
          throw new Error("");
        }

        const value = res[0].value;

        if (value === "message" || value === "syntax") {
          throw new Error();
        }

        if (res[1].type !== "identifier") {
          throw new Error(
            `expected identifier after type declaration, instead saw = ${res[1].type}`
          );
        }

        if (!(res[2].type === "operator" && res[2].value === "=")) {
          throw new Error(
            `expected integer-literal for field number after type declaration, instead saw = type:${
              res[2].type
            },value:${"value" in res[2] ? res[2].value : ""}`
          );
        }
        if (res[3].type !== "integer-literal") {
          throw new Error(
            `expected integer-literal for field number after type declaration, instead saw = ${res[3].type}`
          );
        }

        ast.body.push({
          type: "field",
          fieldType: value,
          name: res[1].value,
          number: res[3].value,
        });

        continue;
      }

      // note: the following only works because I'm only supporting: ints, bools and strings right now
      throw new Error(
        "Unexpected code path, likely don't support the field type."
      );
    }

    return ast;
  }

  private consumeAndAssertSemiColonDelim() {
    const val = this.lexer.consume();

    if (!(val.type === "deliminator" && val.value === ";")) {
      throw new Error(
        `expected a deliminator, instead saw: type = "${val.type}" value = ${
          "value" in val ? val.value : ""
        }`
      );
    }
  }

  public parse(): AST[] {
    const rootAst: AST[] = [];

    let lim = 0;

    while (this.lexer.peek().type !== "eof") {
      if (lim > 50) {
        throw new Error("too much loopy boi");
      }

      lim += 1;

      const peek = this.lexer.peek();

      if (peek.type === "keyword" && peek.value === "syntax") {
        const contents = this.lexer.consume(3);
        this.consumeAndAssertSemiColonDelim();
        if (contents[1].type !== "operator" || contents[1].value !== "=") {
          throw new Error("expected assignment operator after syntax keyword");
        }
        if (
          contents[2].type !== "string-literal" ||
          contents[2].value !== "proto3"
        ) {
          throw new Error('expected "proto3" after syntax assignment operator');
        }

        rootAst.push({
          type: "syntax",
          value: "proto3",
        });

        continue;
      }

      // top level message.
      if (peek.type === "keyword" && peek.value === "message") {
        rootAst.push(this.consumeMessage());

        continue;
      }

      throw new Error(
        `unknown token at root level, token type = "${
          peek.type
        }", token value = "${"value" in peek ? peek.value : ""}"`
      );
    }
    return rootAst;
  }
}
