/** A partial test double fails immediately if production uses an unimplemented member. */
export function strictStub<T extends object>(
  members: Partial<T>,
  name: string,
): T {
  return new Proxy(members as T, {
    get(target, key, receiver): unknown {
      if (!Reflect.has(target, key)) {
        throw new Error(`${name}: unimplemented member ${String(key)}`);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

export class RegisteredMap<K, V> extends Map<K, V> {
  override get(key: K): V {
    const value = super.get(key);
    if (value === undefined) throw new Error(`Not registered: ${String(key)}`);
    return value;
  }
}
