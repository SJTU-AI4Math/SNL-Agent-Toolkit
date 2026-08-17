/** Lossless-JSON predicate required by @deepseek-ai/dsh-tools' schema validator. */
export function isJsonValue(value: unknown): boolean {
  const ancestors = new Set<object>();
  const visit = (current: unknown): boolean => {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return true;
    if (typeof current === 'number') return Number.isFinite(current) && !Object.is(current, -0);
    if (typeof current !== 'object' || ancestors.has(current)) return false;
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype || Reflect.ownKeys(current).length !== current.length + 1) return false;
        for (let index = 0; index < current.length; index++) {
          if (!Object.hasOwn(current, index) || !visit(current[index])) return false;
        }
        return true;
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return false;
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== 'string') return false;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !visit(descriptor.value)) return false;
      }
      return true;
    } finally {
      ancestors.delete(current);
    }
  };
  return visit(value);
}
