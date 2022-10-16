# TS Protobuf Decoder

This is a WIP and currently only decodes LEN and VARINT wire types. It does not yet support full protobuf decoding (i.e. given a protofile + a binary, spits out useful and accurate data), only field number, wire type and wire type value decoding. I've been referring to this as "partial protobuf decoding".

# TODO

- [x] create a generic parseVarint func
- [x] test each func individually.
- [x] test and write the decoder
- [x] handle empty binaries
- [x] support large string lengths (> 127 length)
- [x] support large strings
- [x] support i32
- [x] support i64
- [ ] support repeated
- [ ] support nested messages
- [ ] fully decode VARINTs
- [ ] fully decode LENs
- [ ] turn into CLI tool

# TODO [CHAR|LEXER|PARSER]

https://developers.google.com/protocol-buffers/docs/proto3 - easy
https://developers.google.com/protocol-buffers/docs/reference/proto3-spec - hard
https://developers.google.com/protocol-buffers/docs/text-format-spec - mostly about encoding into proto

https://supunsetunga.medium.com/writing-a-parser-getting-started-44ba70bb6cc9 - good succinct definitions on the steps to a parser

- [x] define the lexical grammar
- [x] define the AST
- [x] define the interface for the reader
- [x] define the interface for the lexer
- [x] define the interface for the parser
- [x] write all the tests
- [ ] write the char reader
- [ ] write the lexer
- [ ] write the parser

## MVP Support

- [ ] syntax
- [ ] top level messages
- [ ] int_32
- [ ] string
- [ ] bool

## Maybe

- [ ] comments
- [ ] repeated
- [ ] nested messages
- [ ] sharing types from other messages (`Foo.Bar.Baz my_baz = 1`)
- [ ] imports
- [ ] oneof
- [ ] maps

# Learnings

- Empty values (i.e. `my_string:""`) are not encoded on the wire.
- Varints are interesting and an important concept in the protobuf wire format
- 0-15 field numbers are important for performance
- `xxd` is a cool tool, lets you decode the raw binary bits from a binary. (i.e. `xxd -b output.bin` => `00000000: 00101000 00000001`)
- `hexdump` was very useful, `hexdump -C your-bin.bin` gives you an easyish to read byte separated print out.\
- `protoc` is not well documented
- tdd always so fun

# Dev

## Testing

> **Note**
> test includes a `generate` function which will help you encode messages for testing

1. Run `yarn jest`

## Generating encoded protobuf binaries

1. Run `./watch.sh` to start the watcher, encoder, and printer.
2. Tweak the `playground.proto` file with the values and field numbers you want (watch script uses the `MyMessage` proto message).
3. Tweak the `data.txt` file with the field name + values that you want to encode ).
