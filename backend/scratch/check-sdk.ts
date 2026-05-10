import * as sdk from "@zama-fhe/relayer-sdk/node";
console.log("Exports:", Object.keys(sdk));
if ((sdk as any).default) {
    console.log("Default exports:", Object.keys((sdk as any).default));
}
