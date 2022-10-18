import type { Ast } from "./parser";

const WIRE_TYPE_MAP = {
  0: "VARINT",
  1: "I64",
  2: "LEN",
  5: "I32",
} as const;

type WIRE_TYPE = typeof WIRE_TYPE_MAP[keyof typeof WIRE_TYPE_MAP];

type DecodedFieldNumberToWireFormatMap = Record<
  number,
  { type: WIRE_TYPE; value: number | number[] }
>;

// varint continuation bit is the MSB, used to tell if you need to
// keep walking the bytes until you get 0 in the continuation bit
// and then you know you've parsed the varint.
const VARINT_CONTINUATION_BIT = 0b10000000;

export function parseVarint(
  binary: Buffer,
  currentByteIndex: number
): { value: number; nextByteIndex: number } {
  // single byte varint (does not have cont. bit set)
  if ((binary[currentByteIndex] & VARINT_CONTINUATION_BIT) === 0) {
    return {
      value: binary[currentByteIndex],
      nextByteIndex: currentByteIndex + 1,
    };
  }

  // multi-byte varint
  const bytes: number[] = [];
  let localIndex = currentByteIndex;

  // traverse till we hit a byte with an unset cont. bit
  while (binary[localIndex] & VARINT_CONTINUATION_BIT) {
    bytes.push(binary[localIndex]);
    localIndex += 1;
  }

  // push the last byte of the varint
  bytes.push(binary[localIndex]);

  const concatenatedBinaryString = bytes
    .map((byte) => byte & 0b01111111) // drop MSB
    .map((bits) => bits.toString(2).padStart(7, "0")) // convert to binary, and only pad the most significant 7 bits (not eight, as we've dropped that, we sort of only have a partial byte here - hence the name "bits")
    .reverse() // varint encoding means we need to convert to little endian
    .reduce((prev, current) => prev + current, ""); // concat to one binary string after little endian conversion

  return {
    value: parseInt(concatenatedBinaryString, 2),
    nextByteIndex: currentByteIndex + bytes.length,
  };
}

export function parseFieldType(byte: number): WIRE_TYPE {
  // first 3 LSBs represent wire type
  const WIRE_TYPE_BITS = 0b00000111;
  const typeBits = WIRE_TYPE_BITS & byte;

  function isWireTypeVal(b: number): b is keyof typeof WIRE_TYPE_MAP {
    return b in WIRE_TYPE_MAP;
  }

  if (!isWireTypeVal(typeBits)) {
    throw new Error(`Unknown wire type = "${typeBits}" (decimal)`);
  }

  const type = WIRE_TYPE_MAP[typeBits];

  return type;
}

/**
 * field numbers are encoded as varints (but with the first 3 LSB used for wire-type)
 */
export function parseFieldNumber(
  binary: Buffer,
  currentByteIndex: number
): {
  fieldNumber: number;
  nextByteIndex: number;
} {
  // if true, is single byte field number (0-15)
  if ((binary[currentByteIndex] & VARINT_CONTINUATION_BIT) === 0) {
    return {
      // shift right 3 places to get field number (only works if cont. bit not set and is first varint byte)
      fieldNumber: binary[currentByteIndex] >> 3,
      nextByteIndex: currentByteIndex + 1,
    };
  }

  const { nextByteIndex, value } = parseVarint(binary, currentByteIndex);

  return {
    // shift value to the right 3 bits here as we need to drop those wire type bits.
    // this ONLY works because of the little endian conversion (first byte ends up last, so we know we can safely drop first three least sig bits.)
    fieldNumber: value >> 3,
    nextByteIndex: nextByteIndex,
  };
}

export function parseFieldValue(
  binary: Buffer,
  currentByteIndex: number,
  type: WIRE_TYPE
): {
  value: number | number[];
  nextByteIndex: number;
} {
  if (type === "VARINT") {
    const res = parseVarint(binary, currentByteIndex);

    return {
      value: res.value,
      nextByteIndex: res.nextByteIndex,
    };
  }

  if (type === "LEN") {
    const bytes = [];
    const { nextByteIndex, value } = parseVarint(binary, currentByteIndex);

    for (let i = 0; i < value; i += 1) {
      bytes.push(binary[nextByteIndex + i]);
    }

    return {
      value: bytes,
      nextByteIndex: nextByteIndex + value,
    };
  }

  // regardless of value (signed, float, fixed), always a fixed four bytes
  if (type === "I32") {
    return {
      nextByteIndex: currentByteIndex + 4,
      value: [
        binary[currentByteIndex],
        binary[currentByteIndex + 1],
        binary[currentByteIndex + 2],
        binary[currentByteIndex + 3],
      ],
    };
  }

  if (type === "I64") {
    return {
      nextByteIndex: currentByteIndex + 8,
      value: [
        binary[currentByteIndex],
        binary[currentByteIndex + 1],
        binary[currentByteIndex + 2],
        binary[currentByteIndex + 3],
        binary[currentByteIndex + 4],
        binary[currentByteIndex + 5],
        binary[currentByteIndex + 6],
        binary[currentByteIndex + 7],
      ],
    };
  }

  throw new Error(`Cannot parse "${type}" wire type yet.`);
}

export function getDecodedFieldNumberToWireFormatMap(
  binary: Buffer
): DecodedFieldNumberToWireFormatMap {
  const map: DecodedFieldNumberToWireFormatMap = {};

  let byteIndex = 0;

  while (typeof binary[byteIndex] !== "undefined") {
    const type = parseFieldType(binary[byteIndex]);
    const parseFieldNumberResponse = parseFieldNumber(binary, byteIndex);
    const parseFieldValueResponse = parseFieldValue(
      binary,
      parseFieldNumberResponse.nextByteIndex,
      type
    );

    map[parseFieldNumberResponse.fieldNumber] = {
      type,
      value: parseFieldValueResponse.value,
    };

    byteIndex = parseFieldValueResponse.nextByteIndex;
  }

  return map;
}

export type MessageFieldNumberMetadata = {
  [key: number]: {
    name: string;
    number: number;
    type: "string" | "bool" | "int32";
    // todo: nested messages here?
  };
};

export function pullMessageMetadataFromAst(
  ast: Ast[],
  messageName: string
): MessageFieldNumberMetadata {
  const message = ast.find(
    (a) => a.type === "message" && a.name === messageName
  );

  if (typeof message === "undefined" || message.type !== "message") {
    throw new Error(
      `Could not find message: "${messageName}" in the provided AST`
    );
  }

  const map: MessageFieldNumberMetadata = {};

  message.body.forEach((b) => {
    if (b.type === "field") {
      map[b.number] = {
        name: b.name,
        number: b.number,
        type: b.fieldType,
      };
    } else {
      throw new Error(`message body type: "${b.type}" not yet supported`);
    }
  });

  return map;
}

export function decodeMessage(
  binary: Buffer,
  protoDefinitionAst: Ast[],
  messageName: string
): Record<string, string | number | boolean>;
// support for partial decoding
export function decodeMessage(
  binary: Buffer,
  protoDefinitionAst?: Ast[],
  messageName?: string
): DecodedFieldNumberToWireFormatMap;
export function decodeMessage(
  binary: Buffer,
  protoDefinitionAst?: Ast[],
  messageName?: string
):
  | Record<string, string | number | boolean>
  | DecodedFieldNumberToWireFormatMap {
  const partialDecoding = getDecodedFieldNumberToWireFormatMap(binary);

  if (
    typeof protoDefinitionAst === "undefined" ||
    typeof messageName === "undefined"
  ) {
    return partialDecoding;
  }

  const messageMeta = pullMessageMetadataFromAst(
    protoDefinitionAst,
    messageName
  );

  const map: Record<string, string | number | boolean> = {};

  Object.values(messageMeta).forEach((meta) => {
    const partiallyDecodedField = partialDecoding[meta.number];

    let formattedValue: string | boolean | number;

    switch (meta.type) {
      case "string": {
        // todo: fix
        formattedValue = partiallyDecodedField?.value
          ? Buffer.from(partiallyDecodedField.value as number[]).toString()
          : "";
        break;
      }
      case "bool": {
        formattedValue = partiallyDecodedField?.value === 1;
        break;
      }
      case "int32": {
        // todo: narrow
        formattedValue = (partiallyDecodedField?.value ?? 0) as number;
        break;
      }
      default: {
        throw new Error(`unknown proto type: ${meta.type}`);
      }
    }

    map[meta.name] = formattedValue;
  });

  return map;
}
