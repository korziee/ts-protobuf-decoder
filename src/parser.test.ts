import { describe, expect, test } from "@jest/globals";
import { AST, Lexer, Parser, Reader } from "./parser";

describe("Reader", () => {
  describe("consume", () => {
    test("should continually return the next character in the source by default", () => {
      const reader = new Reader("foo bar baz");

      expect(reader.consume()).toBe("f");
      expect(reader.consume()).toBe("o");
      expect(reader.consume()).toBe("o");
      expect(reader.consume()).toBe(" ");
    });

    test("should return as many next characters as the consumer asks for", () => {
      const reader = new Reader("foo bar baz");

      expect(reader.consume(3)).toBe("foo");
      expect(reader.consume()).toBe(" ");
    });
  });

  describe("peek", () => {
    test("should consistently return the next character in the source", () => {
      const reader = new Reader("foo bar baz");

      expect(reader.peek()).toBe("f");
      expect(reader.peek()).toBe("f");
    });

    test("should consistently return as many next characters as asked", () => {
      const reader = new Reader("foo bar baz");

      expect(reader.peek(3)).toBe("foo");
      expect(reader.peek(3)).toBe("foo");
      expect(reader.peek(3)).toBe("foo");
    });

    test("should NOT consume any characters from the source", () => {
      const reader = new Reader("foo bar baz");

      expect(reader.peek()).toBe("f");
      expect(reader.consume()).toBe("f");
    });
  });

  describe("eof", () => {
    test("should return true if at the end of the source", () => {
      const reader = new Reader("f");

      reader.consume();

      expect(reader.eof()).toBe(true);
    });

    test("should return false if not at the end of the source", () => {
      const reader = new Reader("f");

      expect(reader.eof()).toBe(false);
    });
  });
});

describe("Lexer", () => {
  describe("peek", () => {
    it("should lookahead as many tokens as required", () => {
      const lexer = new Lexer('syntax = "proto3";');

      expect(lexer.peek(2)).toStrictEqual([
        {
          type: "keyword",
          value: "syntax",
        },
        {
          type: "operator",
          value: "=",
        },
      ]);
    });

    it("should not consume any tokens", () => {
      const lexer = new Lexer('syntax = "proto3";');

      const firstPeek = lexer.peek();
      const secondPeek = lexer.peek();

      expect(firstPeek).toEqual(secondPeek);
      expect(lexer.peek()).toEqual(lexer.consume());
    });
  });

  describe("consume", () => {
    it("should consume as many tokens as required", () => {
      const lexer = new Lexer('syntax = "proto3";');

      expect(lexer.consume(2)).toStrictEqual([
        {
          type: "keyword",
          value: "syntax",
        },
        {
          type: "operator",
          value: "=",
        },
      ]);
    });

    describe("token:keyword", () => {
      it("should consume the syntax keyword", () => {
        const lexer = new Lexer('syntax = "proto3";');

        expect(lexer.consume()).toStrictEqual({
          type: "keyword",
          value: "syntax",
        });
      });

      it("should consume the message keyword", () => {
        const lexer = new Lexer("message NestedMessage {");

        expect(lexer.consume()).toStrictEqual({
          type: "keyword",
          value: "message",
        });
      });

      it("should consume the int32 keyword", () => {
        const lexer = new Lexer("int32 my_int = 1;");

        expect(lexer.consume()).toStrictEqual({
          type: "keyword",
          value: "int32",
        });
      });

      it("should consume the bool keyword", () => {
        const lexer = new Lexer("bool my_bool = 1;");

        expect(lexer.consume()).toStrictEqual({
          type: "keyword",
          value: "bool",
        });
      });

      it("should consume the string keyword", () => {
        const lexer = new Lexer("string my_string = 1;");

        expect(lexer.consume()).toStrictEqual({
          type: "keyword",
          value: "string",
        });
      });
    });

    describe("token:operator", () => {
      it("should consume the assignment operator", () => {
        const lexer = new Lexer("= 1");

        expect(lexer.consume()).toStrictEqual({
          type: "operator",
          value: "=",
        });
      });
    });

    describe("token:deliminator", () => {
      it("should consume the left curly deliminator", () => {
        const lexer = new Lexer("{\nmessage");

        expect(lexer.consume()).toStrictEqual({
          type: "deliminator",
          value: "{",
        });
      });

      it("should consume the right curly deliminator", () => {
        const lexer = new Lexer("}\nmessage {");

        expect(lexer.consume()).toStrictEqual({
          type: "deliminator",
          value: "}",
        });
      });

      it("should consume the semicolon deliminator", () => {
        const lexer = new Lexer(";\nmessage");

        expect(lexer.consume()).toStrictEqual({
          type: "deliminator",
          value: ";",
        });
      });
    });

    describe("token:identifier", () => {
      it("should consume single letter identifiers", () => {
        const lexer = new Lexer("myval = 1;");

        expect(lexer.consume()).toStrictEqual({
          type: "identifier",
          value: "myval",
        });
      });

      it("should consume words split by underscore identifiers", () => {
        const lexer = new Lexer("my_val = 1;");

        expect(lexer.consume()).toStrictEqual({
          type: "identifier",
          value: "my_val",
        });
      });
    });

    describe("token:integer-literal", () => {
      it("should consume single digit integer literals", () => {
        const lexer = new Lexer("1;");

        expect(lexer.consume()).toStrictEqual({
          type: "integer-literal",
          value: 1,
        });
      });

      it("should consume multi digit integer literals", () => {
        const lexer = new Lexer("123123;");

        expect(lexer.consume()).toStrictEqual({
          type: "integer-literal",
          value: 123123,
        });
      });
    });

    describe("token:string-literal", () => {
      it("should consume string literals", () => {
        const lexer = new Lexer(`"proto3";`);

        expect(lexer.consume()).toStrictEqual({
          type: "string-literal",
          value: "proto3",
        });
      });
    });

    describe("token:eof", () => {
      it("should return with an eof token if at EOF", () => {
        const lexer = new Lexer("");

        expect(lexer.consume()).toStrictEqual({
          type: "eof",
        });
      });
    });
  });
});

describe("Parser", () => {
  it("should be able to parse the specified syntax", () => {
    const parser = new Parser(`
      syntax = "proto3";
    `);

    expect(parser.parse()).toStrictEqual([
      {
        type: "syntax",
        value: "proto3",
      },
    ] as AST[]);
  });

  it("should be able to parse an empty message", () => {
    const parser = new Parser(`
      message MyMessage {

      }
    `);

    expect(parser.parse()).toStrictEqual([
      {
        type: "message",
        name: "MyMessage",
        body: [],
      },
    ] as AST[]);
  });

  it("should be able to parse an message with fields", () => {
    const parser = new Parser(`
      message MyMessage {
        int32 my_int = 1;
        bool my_bool = 10;
        string my_string = 20;
      }
    `);

    expect(parser.parse()).toStrictEqual([
      {
        type: "message",
        name: "MyMessage",
        body: [
          {
            type: "field",
            name: "my_int",
            fieldType: "int32",
            number: 1,
          },
          {
            type: "field",
            name: "my_bool",
            fieldType: "bool",
            number: 10,
          },
          {
            type: "field",
            name: "my_string",
            fieldType: "string",
            number: 20,
          },
        ],
      },
    ] as AST[]);
  });

  it("should be able to parse a proto definition with multiple messages", () => {
    const parser = new Parser(`
      message MyFirstMessage {
        int32 my_first_int = 1;
      }

      message MySecondMessage {}

      message MyThirdMessage {
        int32 my_int = 1;
        bool my_bool = 10;
        string my_string = 20;
      }
    `);

    expect(parser.parse()).toStrictEqual([
      {
        type: "message",
        name: "MyFirstMessage",
        body: [
          {
            type: "field",
            name: "my_int",
            fieldType: "int32",
            number: 1,
          },
        ],
      },
      {
        type: "message",
        name: "MyFirstMessage",
        body: [],
      },
      {
        type: "message",
        name: "MyThirdMessage",
        body: [
          {
            type: "field",
            name: "my_int",
            fieldType: "int32",
            number: 1,
          },
          {
            type: "field",
            name: "my_bool",
            fieldType: "bool",
            number: 10,
          },
          {
            type: "field",
            name: "my_string",
            fieldType: "string",
            number: 20,
          },
        ],
      },
    ] as AST[]);
  });
});
