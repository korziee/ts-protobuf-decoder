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

    byteIndex = parseFieldValueResponse.nextByteIndex;

    map[parseFieldNumberResponse.fieldNumber] = {
      type,
      value: parseFieldValueResponse.value,
    };
  }

  return map;
}
