# TODO

- [x] create a generic parseVarint func
- [x] test each func individually.
- [x] test and write the decoder
- [ ] support large strings
- [ ] support i32
- [ ] support i64
- [ ] support repeated
- [ ] support nested messages

# Learnings

- Empty values (i.e. `my_string:""`) are not encoded on the wire.
- Varints are interesting and an important concept in the protobuf wire format
- 0-15 field numbers are important for performance
- `xxd` is a cool tool, lets you decode the raw binary bits from a binary. (i.e. `xxd -b output.bin` => `00000000: 00101000 00000001`)
- `hexdump` was very useful, `hexdump -C your-bin.bin` gives you an easyish to read byte separated print out.\
- `protoc` is not well documented

# Dev

## Testing

> **Note**
> test includes a `generate` function which will help you encode messages for testing

1. Run `yarn jest`

## Generating encoded protobuf binaries

1. Run `./watch.sh` to start the watcher, encoder, and printer.
2. Tweak the `playground.proto` file with the values and field numbers you want (watch script uses the `MyMessage` proto message).
3. Tweak the `data.txt` file with the field name + values that you want to encode ).
