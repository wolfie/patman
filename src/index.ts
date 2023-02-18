import axios, { Method as AxiosMethod, type AxiosResponse, type AxiosRequestConfig } from 'axios';
import * as t from 'io-ts';
import { stringify } from 'qs';

const tap =
  <T>(tapper: (t: T) => void) =>
  (t: T): T => {
    tapper(t);
    return t;
  };

const LOG = false as boolean;

const logger = LOG ? (...args: any[]) => console.log(...args) : () => {};
if (LOG) axios.interceptors.request.use(tap((request) => logger({ headers: request.headers })));

const decode =
  <T extends t.Any>(t: T) =>
  (x: unknown): t.TypeOf<T> => {
    const result = t.decode(x);
    if (result._tag === 'Right') return result.right;
    else throw new Error(JSON.stringify(result.left));
  };

const AxiosResponse = <T extends t.Any>(data: T) =>
  t.type({
    data,
    status: t.number,
    statusText: t.string,
    headers: t.UnknownRecord,
    config: t.UnknownRecord,
  });

type ParamValues = string | number | boolean;
type Endpoint<ARGS extends t.Any, BODY extends t.Any> = {
  method: AxiosMethod;
  body?: BODY;
} & (
  | {
      args?: undefined;
      path: string;
      headers?: Record<string, string>;
      params?: Record<string, ParamValues | ParamValues[]>;
    }
  | {
      args: ARGS;
      path: (args: t.TypeOf<ARGS>) => string;
      headers?: (args: t.TypeOf<ARGS>) => Record<string, string>;
      params?: (args: t.TypeOf<ARGS>) => Record<string, ParamValues | ParamValues[]>;
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
    (args: t.TypeOf<E['args']>): Promise<AxiosResponse<t.TypeOf<E['body']>>> => {
      const axiosOptions: AxiosRequestConfig = {
        method: e.method,
        url: `${s.baseUrl}${typeof e.path === 'string' ? e.path : e.path(args)}`,
        headers: { ...s.headers, ...e.headers },
        params: typeof e.params === 'function' ? e.params(args) : e,
        paramsSerializer: { serialize: (params) => stringify(params, { arrayFormat: 'repeat' }) },
      };

      logger(JSON.stringify({ axiosOptions, uri: axios.getUri(axiosOptions) }, null, 2));

      const promise = axios.request(axiosOptions).then(decode(AxiosResponse(e.body ?? t.unknown)));
      if (LOG) {
        promise
          .then((response) =>
            logger({
              status: `${response.status} ${response.statusText}`,
              headers: response.headers,
            })
          )
          .catch(logger);
      }
      return promise as any;
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

const patman = new Patman(
  {
    prod: {
      baseUrl: 'https://baconipsum.com/api',
    } satisfies ServiceEnv,
  },
  {
    meatAndFiller: {
      method: 'GET',
      args: MeatAndFillerArgs,
      path: () => `/`,
      params: (args) => args,
      body: t.array(t.string),
    } satisfies Endpoint<typeof MeatAndFillerArgs, any>,
  }
);

patman
  .$({ prod: 'meatAndFiller' })({ type: 'all-meat', paras: 1 })
  .then((response) => response.data)
  .then(console.log);
