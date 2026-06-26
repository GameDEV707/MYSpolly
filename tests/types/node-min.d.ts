/*
 * Minimal ambient declarations for the subset of Node's built-in test runner
 * and assertion library used by the engine unit tests.
 *
 * Rationale: the engine is verified in an offline sandbox where `@types/node`
 * cannot be installed from a registry. These shims let the globally available
 * `tsc` typecheck the tests via `tsconfig.engine.json`. In a connected
 * environment the real `@types/node` is installed and used by `tsconfig.json`
 * (which deliberately excludes this file).
 */

declare module 'node:test' {
  type TestFn = () => void | Promise<void>;
  export function test(name: string, fn: TestFn): void;
  export function it(name: string, fn: TestFn): void;
  export function describe(name: string, fn: () => void): void;
  export function before(fn: TestFn): void;
  export function after(fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;
}

declare module 'node:assert/strict' {
  interface AssertStrict {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    strictEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    deepStrictEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, expected?: unknown, message?: string): void;
    doesNotThrow(fn: () => unknown, message?: string): void;
    fail(message?: string): never;
    match(value: string, regexp: RegExp, message?: string): void;
  }
  const assert: AssertStrict;
  export default assert;
}


// `structuredClone` is a Node 17+/browser global used for pure deep-cloning in
// the reducer. It is in lib.dom / @types/node; declared here for the offline
// engine typecheck (ES2022 lib only).
declare function structuredClone<T>(value: T): T;
