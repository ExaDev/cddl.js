Test fixtures copied verbatim from [ExaDev/wire-mesh](https://github.com/ExaDev/wire-mesh): `spec/protocol.cddl` and `conformance/{frames,handshake,tokens}.v1.json`. wire-mesh's own spec is the real-world CDDL cddl.js is scoped to generate against, and its conformance vectors are the ground truth `test/round-trip.test.ts` checks every generated schema against.

These are a snapshot, not a live reference -- refresh by copying the same files again from a wire-mesh checkout whenever its spec or vectors change:

```sh
cp <wire-mesh>/spec/protocol.cddl test/fixtures/protocol.cddl
cp <wire-mesh>/conformance/{frames,handshake,tokens}.v1.json test/fixtures/
```
