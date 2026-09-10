# spike/

Artifacts from the foundation spike recorded in [docs/0002-spike.md](../docs/0002-spike.md).

`cddl-cbor-operator.patch` is the exact diff applied to [webdriverio/cddl](https://github.com/webdriverio/cddl)'s `packages/cddl/src` to make the spike run — the three-part patch (operator tables, guarded `parseOperator` call, non-crashing error message) that the real upstream PR will carry, plus tests.

To reproduce the spike outcome:

```
git clone https://github.com/webdriverio/cddl.git
cd cddl
git apply /path/to/cddl-cbor-operator.patch
pnpm install --frozen-lockfile
pnpm run compile:cddl
node -e "const { parse } = require('./packages/cddl/build/index.js'); \
  const ast = parse('/path/to/upgraded-protocol.cddl'); console.log(ast.length, 'rules')"
```

where `upgraded-protocol.cddl` is wire-mesh's `spec/protocol.cddl` with `token-claims`' `parent` field rewritten from `? parent: bstr, ; bstr .cbor capability-token` to `? parent: bstr .cbor capability-token`. Expected: the rule count prints and the parse completes in well under a second.

One caution learned the hard way during the spike: when concatenating `*.cddl` files to build the test input, exclude the output file from the glob — a `cat *.cddl > out.cddl` loop whose output matches its own glob appends the file to itself until the disk fills.
