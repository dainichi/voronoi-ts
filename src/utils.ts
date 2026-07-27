export function assert(cond: unknown, msg = "Assertion failed"): asserts cond {
    if (!cond) {
        console.trace(msg);
        throw new Error(msg);
    }
}