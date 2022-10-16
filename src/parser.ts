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
}

export class Lexer {
  private reader: Reader;

  constructor(private proto: string) {
    this.reader = new Reader(this.proto);
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
    return /^[a-z][a-z0-9_]*$/.test(value);
  }

  private getToken(value: string): Token {
    if (this.isKeyword(value)) {
      return { type: "keyword", value };
    }

    if (this.isDeliminator(value)) {
      return { type: "deliminator", value };
    }

    if (this.isIntegerLiteral(value)) {
      return { type: "integer-literal", value: parseInt(value, 2) };
    }

    if (this.isStringLiteral(value)) {
      return { type: "string-literal", value };
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
    throw new Error("not implemented");
  }

  public consume(tokens: number): Token[];
  public consume(tokens: 1): Token;
  public consume(tokens?: never): Token;
  public consume(tokens: number = 1): Token | Token[] {
    const tokes: Token[] = [];

    for (let i = 0; i < tokens; i += 1) {
      let chars = "";

      // consume chars
      while (!this.isWhitespace(this.reader.peek())) {
        throw new Error("here");
        chars += this.reader.consume();
      }

      throw new Error(chars);

      // consume whitespace so next run through is clean
      while (this.isWhitespace(this.reader.peek())) {
        this.reader.consume();
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

  public parse(): AST[] {
    throw new Error("not implemented");
  }
}
