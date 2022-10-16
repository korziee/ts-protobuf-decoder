// Define lexical grammer, will be used in the lexer

type Token =
  | {
      type: "keyword";
      value: ("syntax" | "message") | ("int32" | "bool" | "string");
    }
  | {
      type: "operator";
      value: "=";
    }
  | {
      type: "deliminator";
      value: "{" | "}" | ";";
    }
  | {
      type: "identifier";
      value: string;
    }
  | {
      type: "integer-literal";
      value: number;
    }
  | {
      // used for things like syntax + import... maybe?
      type: "string-literal";
      value: string;
    }
  | { type: "eof" };

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

type AST = ASTCollection[keyof ASTCollection];

export class Reader {
  private originalSource: string;

  constructor(private source: string) {
    this.originalSource = source;
  }

  public consume(characters: number = 1): string {
    throw new Error("not implemented");
  }

  public peek(characters: number = 1): string {
    throw new Error("not implemented");
  }

  public eof(): boolean {
    throw new Error("not implemented");
  }
}

export class Lexer {
  constructor(private reader: Reader) {}

  public peek(tokens: number): Token[];
  public peek(tokens: 1): Token;
  public peek(tokens?: never): Token;
  public peek(tokens: number | undefined): Token | Token[] {
    throw new Error("not implemented");
  }

  public consume(tokens: number = 1): Token {
    throw new Error("not implemented");
  }
}

export class Parser {
  private reader: Reader;
  private lexer: Lexer;

  constructor(private proto: string) {
    this.reader = new Reader(this.proto);
    this.lexer = new Lexer(this.reader);
  }

  public parse(): AST[] {
    throw new Error("not implemented");
  }
}
