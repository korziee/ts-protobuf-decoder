# TS Protobuf Decoder

This project implements a protobuf wire-type decoder and a parser (so far). The wire-type decoder essentially converts the message binary into a wire-type + field number combo. The parser is a mostly (WIP) to spec protobuf parser based on the language format defined [here](https://developers.google.com/protocol-buffers/docs/reference/proto3-spec).

This still a WIP. See below for more info on where its at

## Partial Decoding Support (decodes and segments the binary)

### Wire Types

- [x] LEN
- [x] VARINT
- [x] I32
- [x] I64
- [ ] SGROUP (will never support)
- [ ] EGROUP (will never support)

### Functionality

- [ ] repeated
- [ ] packed

## Parser Support

- [x] syntax
- [x] top level messages
- [ ] top level enum fields
- [x] bool message field
- [x] int32 message field
- [x] string message field
- [ ] nested message fields
- [ ] shared message fields (accessing nested message from another message)
- [ ] enum message field
- [ ] oneof messaged field
- [ ] map message field
- [ ] packed fields
- [ ] repeated fields
- [ ] options
- [ ] imports
- [ ] comments

## Decoding (e.g. binary to JSON)

- [x] support all things parser supports

# General TODO

- [x] turn into primitive CLI tool

# Notes/Resources

https://developers.google.com/protocol-buffers/docs/proto3 - easy
https://developers.google.com/protocol-buffers/docs/reference/proto3-spec - hard
https://developers.google.com/protocol-buffers/docs/text-format-spec - mostly about encoding into proto

https://supunsetunga.medium.com/writing-a-parser-getting-started-44ba70bb6cc9 - good succinct definitions on the steps to a parser

# Learnings

- Empty values (i.e. `my_string:""`) are not encoded on the wire.
- Varints are interesting and an important concept in the protobuf wire format
- 0-15 field numbers are important for performance
- `xxd` is a cool tool, lets you decode the raw binary bits from a binary. (i.e. `xxd -b output.bin` => `00000000: 00101000 00000001`)
- `hexdump` was very useful, `hexdump -C your-bin.bin` gives you an easyish to read byte separated print out.\
- `protoc` is not well documented
- tdd always so fun, like seriously so good.
- reader/lexer/parser distinction made this a lot easier than I expected

# Dev

## Testing

> **Note**
> test includes a `generate` function which will help you encode messages for testing

1. Run `yarn jest`

## Generating encoded protobuf binaries

1. Run `./watch.sh` to start the watcher, encoder, and printer.
2. Tweak the `playground.proto` file with the values and field numbers you want (watch script uses the `MyMessage` proto message).
3. Tweak the `data.txt` file with the field name + values that you want to encode ).

## Running the CLI tool

`yarn ts-node src/index.ts --binary output.bin -m MyMessage -d ./playground.proto`

> **Note**
> rn it can only parse a proto file with limited fields, so the playground.proto file will fail.
