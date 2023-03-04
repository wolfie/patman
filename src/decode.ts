import type * as t from 'io-ts';
import IotsParseError from './IotsParseError';

const $decode =
  <T extends t.Any>(t: T) =>
  (x: unknown): t.TypeOf<T> => {
    const result = t.decode(x);
    if (result._tag === 'Right') return result.right;
    else throw new IotsParseError(result.left);
  };

function decode<T extends t.Any>(t: T): (x: unknown) => t.TypeOf<T>;
function decode<T extends t.Any>(t: T, x: unknown): t.TypeOf<T>;
function decode(t: t.Any, x?: unknown) {
  if (typeof x === 'undefined') return $decode(t);
  else return $decode(t)(x);
}

export default decode;
