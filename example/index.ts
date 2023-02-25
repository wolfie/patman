import Patman, { Endpoint } from '../src';
import * as t from 'io-ts';
import { isAxiosError } from 'axios';
import { IotsParseError } from '../src/iots-utils';

const MeatAndFillerArgs = t.intersection([
  t.type({
    type: t.union([t.literal('meat-and-filler'), t.literal('all-meat')]),
  }),
  t.partial({
    paras: t.number,
    startWithLorem: t.literal(1),
    format: t.union([t.literal('json'), t.literal('text'), t.literal('html')]),
  }),
]);

const patman = new Patman(
  { prod: { baseUrl: 'https://baconipsum.com/api' } },
  {
    meatAndFiller: {
      method: 'GET',
      args: MeatAndFillerArgs,
      path: () => `/`,
      params: (args) => args,
      body: t.array(t.string),
    } satisfies Endpoint<typeof MeatAndFillerArgs, any>,
    static: {
      method: 'GET',
      path: '/',
      params: { type: 'meat-and-filler' },
      body: t.array(t.string),
    },
  }
);

const handleIotsParseError =
  <T>(fallbackValue: T) =>
  (e: unknown): T => {
    if (e instanceof IotsParseError) return fallbackValue;
    else throw e;
  };

const handleAxios404Response =
  <T>(fallbackValue: T) =>
  (e: unknown) => {
    if (isAxiosError(e) && e.response?.status === 404) {
      return fallbackValue;
    } else throw e;
  };

(async () => {
  const result1 = patman
    .$({ prod: 'meatAndFiller' })({ type: 'all-meat', paras: 1 })
    .then((response) => response.data)
    .catch(handleIotsParseError<string[]>([]));

  const result2 = patman
    .$({ prod: 'static' })()
    .then((response) => response.data)
    .catch(handleIotsParseError<string[]>([]))
    .catch(handleAxios404Response<string[]>([]));
})();
