import axios, {
  Method as AxiosMethod,
  type AxiosResponse,
  type AxiosRequestConfig,
  AxiosError,
} from 'axios';
import debug from './debug';
import * as t from 'io-ts';
import { stringify } from 'qs';
import { decode, IotsParseError } from './iots-utils';

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const getRandomChars = () =>
  Array(8)
    .fill(undefined)
    .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
    .join('');

let reqId = 0;
type Enhancement = { reqId: number; logger: debug.Debugger };
type AxiosRequestEnhanced = AxiosRequestConfig & Enhancement;
const isEnhanced = <T>(config: T): config is T & Enhancement =>
  typeof (config as any)['reqId'] === 'number';

const logger = debug('patman');

const removeUndefinedProps = <T>(t: Record<string, T | undefined>): Record<string, T> =>
  Object.fromEntries(Object.entries(t).filter(([_, value]) => typeof value !== 'undefined')) as any;

const tap =
  <T>(tapper: (t: T) => void) =>
  (t: T): T => {
    tapper(t);
    return t;
  };

if (logger.enabled) {
  axios.interceptors.request.use(
    tap((request) => isEnhanced(request) && request.logger('[req] [headers]:', request.headers))
  );
}
const AxiosResponse = <T extends t.Any>(data: T) =>
  t.type({
    data,
    status: t.number,
    statusText: t.string,
    headers: t.UnknownRecord,
    config: t.UnknownRecord,
  });

export type ParamValues = string | number | boolean;
export type Endpoint<ARGS extends t.Any, BODY extends t.Any> = {
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
      path: string | ((args: t.TypeOf<ARGS>) => string);
      headers?: Record<string, string> | ((args: t.TypeOf<ARGS>) => Record<string, string>);
      params?:
        | Record<string, ParamValues | ParamValues[]>
        | ((args: t.TypeOf<ARGS>) => Record<string, ParamValues | ParamValues[]>);
    }
);

export type ServiceEnv = {
  baseUrl: `${'http' | 'https'}://${string}`;
  headers?: Record<string, string>;
};

class Patman<SNAMES extends string, E extends Record<string, Endpoint<any, any>>> {
  constructor(private readonly s: Record<SNAMES, ServiceEnv>, private readonly e: E) {}

  private fnFromServiceandEndpoint =
    <S extends ServiceEnv, E extends Endpoint<any, any>>(s: S, e: E) =>
    (args: t.TypeOf<E['args']>): Promise<AxiosResponse<t.TypeOf<E['body']>>> => {
      const axiosOptions: AxiosRequestEnhanced = {
        method: e.method,
        url: `${s.baseUrl}${typeof e.path === 'string' ? e.path : e.path(args)}`,
        headers: { ...s.headers, ...e.headers },
        params: typeof e.params === 'function' ? e.params(args) : e.params,
        paramsSerializer: {
          serialize: (params) => stringify(removeUndefinedProps(params), { arrayFormat: 'repeat' }),
        },
        reqId: reqId++,
        logger: logger.extend(`${reqId}#${getRandomChars()}`),
      };

      axiosOptions.logger('[req]', e.method, axios.getUri(axiosOptions));

      const promise = axios.request(axiosOptions).then(decode(AxiosResponse(e.body ?? t.unknown)));
      return axiosOptions.logger.enabled
        ? (promise
            .then(
              tap((response) => {
                axiosOptions.logger(
                  '[res]',
                  '[status]:',
                  `${response.status} ${response.statusText}`
                );
                axiosOptions.logger('[res]', '[headers]:', response.headers);
              })
            )
            .catch((e) => {
              if (e instanceof AxiosError) axiosOptions.logger('[res]', 'AxiosError: ' + e.message);
              else if (e instanceof IotsParseError)
                axiosOptions.logger('[res]', 'IotsParseError: ' + e.message);
              throw e;
            }) as any)
        : promise;
    };

  $ = <SNAME extends SNAMES, ENAME extends keyof E>(path: Record<SNAME, ENAME>) => {
    const serviceName = Object.keys(path)[0] as SNAME;
    const fn = this.fnFromServiceandEndpoint(this.s[serviceName], this.e[path[serviceName]]);
    type FN = typeof fn;
    return fn as E[ENAME]['args'] extends t.Any ? FN : () => ReturnType<FN>;
  };
}

export default Patman;
