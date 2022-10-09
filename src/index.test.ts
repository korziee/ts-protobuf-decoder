import { tmpdir } from "node:os";
import { exec as execUsingCallback } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import { promisify } from "node:util";
const exec = promisify(execUsingCallback);
import {
  getDecodedFieldNumberToWireFormatMap,
  parseFieldNumber,
  parseFieldType,
  parseFieldValue,
  parseVarint,
} from "./";
import { readFile } from "node:fs/promises";

async function generate(
  values: Record<string, string | number | boolean>
): Promise<string> {
  const location = `${tmpdir()}/${uuidv4()}.bin`;

  const str = Object.entries(values)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}:"${value}"`;
      } else {
        return `${key}:${value}`;
      }
    })
    .join("\n");

  await exec(
    `echo '${str}' | protoc --proto_path=$PWD --encode="TestFileMessage" $PWD/playground.proto > ${location}`
  );

  return location;
}

describe("parseVarint", () => {
  test("should successfully parse single byte varints", () => {
    // validate value + next byte index
    expect(parseVarint(Buffer.from([0x01]), 0)).toStrictEqual({
      value: 0b1,
      nextByteIndex: 1,
    });
  });

  test("should successfully parse multi byte varints", () => {
    // validate value + next byte index
    expect(parseVarint(Buffer.from([0xe4, 0x0f]), 0)).toStrictEqual({
      value: 0b00011111100100, // 2020
      nextByteIndex: 2,
    });

    expect(parseVarint(Buffer.from([0xff, 0x32]), 0)).toStrictEqual({
      value: 0b01100101111111, // 6527
      nextByteIndex: 2,
    });

    expect(parseVarint(Buffer.from([0xe9, 0x81, 0x02]), 0)).toStrictEqual({
      value: 0b000001000000011101001, // 33001
      nextByteIndex: 3,
    });
  });

  test.todo("should stop parsing at x bytes with continuation bits");
});

describe("parseFieldType", () => {
  it("should throw on an unknown wire type", () => {
    expect(() => parseFieldType(0b00000111)).toThrowError(
      `Unknown wire type = "7" (decimal)`
    );
  });

  it("should parse a byte with a VARINT wire type correctly", () => {
    expect(parseFieldType(0b00000000)).toEqual("VARINT");
  });

  it("should parse a byte with a LEN wire type correctly", () => {
    expect(parseFieldType(0b00000010)).toEqual("LEN");
  });

  it("should parse a byte with a I64 wire type correctly", () => {
    expect(parseFieldType(0b00000001)).toEqual("I64");
  });

  it("should parse a byte with a I32 wire type correctly", () => {
    expect(parseFieldType(0b00000101)).toEqual("I32");
  });
});

describe("parseFieldNumber", () => {
  it("should parse single byte field numbers", () => {
    // 0-15 are single byte field numbers (because of the LSB 3 bits being used for field types.)
    expect(parseFieldNumber(Buffer.from([0x50]), 0)).toStrictEqual({
      fieldNumber: 10,
      nextByteIndex: 1,
    });
    expect(parseFieldNumber(Buffer.from([0x78]), 0)).toStrictEqual({
      fieldNumber: 15,
      nextByteIndex: 1,
    });
  });

  it("should parse multi byte field numbers", () => {
    expect(parseFieldNumber(Buffer.from([0x80, 0x20]), 0)).toStrictEqual({
      fieldNumber: 512,
      nextByteIndex: 2,
    });

    expect(parseFieldNumber(Buffer.from([0x80, 0x01]), 0)).toStrictEqual({
      fieldNumber: 16,
      nextByteIndex: 2,
    });
  });
});

describe("parseFieldValue", () => {
  test("should throw on unsupported types for now", () => {
    expect(() => parseFieldValue(Buffer.from([]), 0, "I32")).toThrow();
    expect(() => parseFieldValue(Buffer.from([]), 0, "I64")).toThrow();
  });

  describe("varint", () => {
    it("should parse single byte varint values", () => {
      expect(parseFieldValue(Buffer.from([0x0a]), 0, "VARINT")).toStrictEqual({
        nextByteIndex: 1,
        value: 10,
      });

      expect(parseFieldValue(Buffer.from([0x7f]), 0, "VARINT")).toStrictEqual({
        nextByteIndex: 1,
        value: 127,
      });
    });

    it("should parse multi byte varint values", () => {
      expect(
        parseFieldValue(Buffer.from([0x80, 0x01]), 0, "VARINT")
      ).toStrictEqual({
        nextByteIndex: 2,
        value: 128,
      });

      expect(
        parseFieldValue(Buffer.from([0xac, 0x02]), 0, "VARINT")
      ).toStrictEqual({
        nextByteIndex: 2,
        value: 300,
      });
    });

    it("should parse a 64 bit value", () => {
      expect(
        parseFieldValue(
          Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]),
          0,
          "VARINT"
        )
      ).toStrictEqual({
        value: 9223372036854775806,
        nextByteIndex: 9,
      });
    });

    it("should parse a signed 64 bit value", () => {
      expect(
        parseFieldValue(
          Buffer.from([
            0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
          ]),
          0,
          "VARINT"
        )
      ).toStrictEqual({
        // value is decoded properly by protobuf client using zig zag encoding, cheeky * 2 here tho
        value: 9223372036854775807 * 2,
        nextByteIndex: 10,
      });
    });
  });

  describe("len", () => {
    it("should parse single byte len values", () => {
      expect(
        parseFieldValue(Buffer.from([0x01, 0x68]), 0, "LEN")
      ).toStrictEqual({
        nextByteIndex: 2,
        value: [...Buffer.from("h").values()],
      });

      expect(
        parseFieldValue(Buffer.from([0x01, 0x31]), 0, "LEN")
      ).toStrictEqual({
        nextByteIndex: 2,
        value: [...Buffer.from("1").values()],
      });
    });

    it.todo("should parse len values of more than 256 bytes");

    it("should parse multi byte len values", () => {
      expect(
        parseFieldValue(
          Buffer.from([
            0x0b, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c,
            0x64,
          ]),
          0,
          "LEN"
        )
      ).toStrictEqual({
        nextByteIndex: 12,
        value: [...Buffer.from("hello world").values()],
      });

      expect(
        parseFieldValue(
          Buffer.from([
            0x0c, 0x66, 0x6f, 0x6f, 0x21, 0x62, 0x61, 0x72, 0x5f, 0x62, 0x61,
            0x7a, 0x3b,
          ]),
          0,
          "LEN"
        )
      ).toStrictEqual({
        nextByteIndex: 13,
        value: [...Buffer.from("foo!bar_baz;").values()],
      });
    });
  });
});

describe("getDecodedFieldNumberToWireFormatMap", () => {
  test("should decode messages with a single field correctly", async () => {
    const binaryLocation = await generate({
      my_int: 10,
    });

    const binary = await readFile(binaryLocation);

    expect(getDecodedFieldNumberToWireFormatMap(binary)).toStrictEqual({
      1: {
        type: "VARINT",
        value: 10,
      },
    });
  });

  test("should decode messages with multiple fields correctly", async () => {
    const binaryLocation = await generate({
      my_int: 10,
      my_string: "hello world foo bar",
      my_bool: true,
    });

    const binary = await readFile(binaryLocation);

    expect(getDecodedFieldNumberToWireFormatMap(binary)).toStrictEqual({
      1: {
        type: "VARINT",
        value: 10,
      },
      10: {
        type: "LEN",
        value: [...Buffer.from("hello world foo bar").values()],
      },
      20: {
        type: "VARINT",
        value: 1,
      },
    });
  });
});