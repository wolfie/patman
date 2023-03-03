# Patman

A small programmatic library for consuming APIs.

## Example

```typescript
import * as t from 'io-ts';
import { createEndpoint, pat, Service } from 'patman';

const MeatAndFillerArgs = t.intersection([
  t.type({
    type: t.union([t.literal('meat-and-filler'), t.literal('all-meat')]),
  }),
  t.partial({
    paras: t.number,
    sentences: t.number,
    startWithLorem: t.literal(1),
    format: t.union([t.literal('json'), t.literal('text'), t.literal('html')]),
  }),
]);

const baconService = { baseUrl: 'https://baconipsum.com/api' } satisfies Service;

const meatAndFiller = createEndpoint(
  {
    method: 'GET',
    path: '/',
    params: ({ startWithLorem, ...params }) => ({
      ...params,
      'start-with-lorem': startWithLorem,
    }),
  },
  {
    args: MeatAndFillerArgs,
    returnBody: t.array(t.string),
  }
);

const staticEndpoint = createEndpoint({
  method: 'GET',
  path: '/',
  params: { type: 'meat-and-filler' },
});

(async () => {
  const callMeatAndFiller = pat(baconService, meatAndFiller);
  const result1 = await callMeatAndFiller({ type: 'all-meat', paras: 1 }).then(
    (response) => response.data
  );

  const callStatic = pat(baconService, staticEndpoint);
  const result2 = await callStatic().then((response) => response.data);
})();
```
