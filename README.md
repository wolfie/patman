# Patman

A small programmatic library for consuming APIs.

## Debug output

Having the environment variable `DEBUG=patman*` will output information about the transactions themselves. More on the variable formatting [in the `debug` package](https://www.npmjs.com/package/debug#windows-command-prompt-notes).

e.g.

```shell
$ DEBUG=patman* yarn start
```

## Authorization Header Censored by Default

If you want the `DEBUG` output to not censor the `Authorization` header, set the environment variable `SHOW_AUTH_HEADER` to any _truthy_ value

e.g.

```shell
$ SHOW_AUTH_HEADER=1 yarn start
```

## Example

```typescript
import * as t from 'io-ts';
import { combine, createCallFunction, createEndpoint, Service } from 'patman';
import handleAxios404Response from 'patman/lib/handleAxios404Response';
import handleIotsParseError from 'patman/lib/handleIotsParseError';

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
  const callMeatAndFiller = createCallFunction(baconService, meatAndFiller);
  const result1 = await callMeatAndFiller({ type: 'all-meat', paras: 1 })
    .then((response) => response.data)
    .catch(handleIotsParseError<string[]>([]));

  const callStatic = createCallFunction(baconService, staticEndpoint);
  const result2 = await callStatic()
    .then((response) => response.data)
    .catch(handleIotsParseError<string[]>([]))
    .catch(handleAxios404Response<string[]>([]));

  console.log({ result1, result2 });
})();

(async () => {
  const baconIpsum = combine({ prod: baconService }, { meatAndFiller, staticEndpoint });
  baconIpsum.prod
    .meatAndFiller({ type: 'all-meat' })
    .then(({ data }) => console.log('baconIpsum.prod.meatAndFiller', data));
})();
```
