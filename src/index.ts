import { parseArgs, ParseArgsConfig } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { Parser } from "./parser";
import { decodeMessage } from "./decoder";

// validate params
// parse proto definition

// args =
// binary, b
// message, m
// definition, d

const { values, positionals } = parseArgs({
  options: {
    binary: {
      type: "string",
      short: "b",
    },
    message: {
      type: "string",
      short: "m",
    },
    definition: {
      type: "string",
      short: "d",
    },
  },
});

if (!values.binary) {
  throw new Error("expected path to binary to be provided at --binary option");
}

if (!existsSync(values.binary)) {
  throw new Error(`binary at "${values.binary}" does not exist`);
}

const bin = readFileSync(values.binary);
let definitionFile: Buffer | null = null;

if (values.definition) {
  if (!existsSync(values.definition)) {
    throw new Error(`could not find .proto file at "${values.definition}"`);
  }

  if (!values.message) {
    throw new Error("expected message name if definition was provided");
  }

  definitionFile = readFileSync(values.definition);
}

if (values.message && !values.definition) {
  throw new Error(
    "cannot decode a message without reference to a .proto definition"
  );
}

if (definitionFile instanceof Buffer && values.message) {
  const parser = new Parser(definitionFile.toString());
  console.log(decodeMessage(bin, parser.parse(), values.message));
} else {
  console.log(decodeMessage(bin));
}
