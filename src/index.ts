import axios, { Method as AxiosMethod } from 'axios';
import * as t from 'io-ts';

const decode =
  <T extends t.Any>(t: T) =>
  (x: unknown): t.TypeOf<T> => {
    const result = t.decode(x);
    if (result._tag === 'Right') return result.right;
    else throw new Error(JSON.stringify(result.left));
  };

const Response = <T extends t.Any>(data: T) => t.type({ data });
type Response<T> = { data: T };

type Endpoint<ARGS extends t.Any, BODY extends t.Any> = {
  method: AxiosMethod;
  body?: BODY;
} & (
  | {
      args?: undefined;
      path: string;
      headers?: Record<string, string>;
    }
  | {
      args: ARGS;
      path: (args: t.TypeOf<ARGS>) => string;
      headers?: (args: t.TypeOf<ARGS>) => Record<string, string>;
    }
);

type ServiceEnv = {
  baseUrl: `${'http' | 'https'}://${string}`;
  headers?: Record<string, string>;
};

class Patman<SNAMES extends string, E extends Record<string, Endpoint<any, any>>> {
  constructor(private readonly s: Record<SNAMES, ServiceEnv>, private readonly e: E) {}

  private fnFromServiceandEndpoint =
    <S extends ServiceEnv, E extends Endpoint<any, any>>(s: S, e: E) =>
    (args: t.TypeOf<E['args']>): Promise<Response<t.TypeOf<E['body']>>> => {
      const a = axios.request({
        method: e.method,
        url: `${s.baseUrl}${typeof e.path === 'string' ? e.path : e.path(args)}`,
        headers: { ...s.headers, ...e.headers },
      });

      return a.then(decode(Response(e.body ?? t.unknown))) as any;
    };

  $ = <SNAME extends SNAMES, ENAME extends keyof E>(path: Record<SNAME, ENAME>) => {
    const serviceName = Object.keys(path)[0] as SNAME;
    const fn = this.fnFromServiceandEndpoint(this.s[serviceName], this.e[path[serviceName]]);
    type FN = typeof fn;
    return fn as E[ENAME]['args'] extends t.Any ? FN : () => ReturnType<FN>;
  };
}

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

type NoUndefinedField<T> = { [P in keyof T]-?: NoUndefinedField<NonNullable<T[P]>> };
const removeNullishProperties = <T extends Record<string, any>>(t: T): NoUndefinedField<T> =>
  Object.fromEntries(
    Object.entries(t).filter(([_, value]) => typeof value !== 'undefined' && value !== null)
  ) as any;
const propsToString = <T extends Record<string, any>>(t: T): { [P in keyof T]: string } =>
  Object.fromEntries(Object.entries(t).map(([key, value]) => [key, String(value)])) as any;

const patman = new Patman(
  {
    prod: {
      baseUrl: 'https://baconipsum.com/api',
      headers: { Cerp: 'foo', Bars: 'derp' },
    } satisfies ServiceEnv,
  },
  {
    meatAndFiller: {
      method: 'GET',
      args: MeatAndFillerArgs,
      path: (args) =>
        `/?${new URLSearchParams(propsToString(removeNullishProperties(args))).toString()}`,
      headers: () => ({ Cerp: 'bar' }),
      body: t.array(t.string),
    } satisfies Endpoint<typeof MeatAndFillerArgs, any>,
  }
);

patman
  .$({ prod: 'meatAndFiller' })({ type: 'all-meat', paras: 1 })
  .then((response) => response.data)
  .then(console.log);
