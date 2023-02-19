import axios, {
  Method as AxiosMethod,
  type AxiosResponse,
  type AxiosRequestConfig,
  AxiosError,
} from 'axios';
import * as t from 'io-ts';
import { stringify } from 'qs';
import debug from 'debug';

let reqId = 0;
type AxiosRequestConfigWithCorrelationId = AxiosRequestConfig & { reqId: number };
const hasReqId = <T>(config: T): config is T & { reqId: number } =>
  typeof (config as any)['reqId'] === 'number';

const logger = debug('patman');
const requestLogger = logger.extend('request');
const responseLogger = logger.extend('response');

const removeUndefinedProps = <T>(t: Record<string, T | undefined>): Record<string, T> =>
  Object.fromEntries(Object.entries(t).filter(([_, value]) => typeof value !== 'undefined')) as any;

const tap =
  <T>(tapper: (t: T) => void) =>
  (t: T): T => {
    tapper(t);
    return t;
  };

if (requestLogger.enabled)
  axios.interceptors.request.use(
    tap((request) =>
      requestLogger(hasReqId(request) ? request.reqId : '###', '[headers]:', request.headers)
    )
  );

const cropStringEnd = (maxLength: number) => (string: string) =>
  string.length > maxLength ? string.substring(0, maxLength) + '…' : string;
const cropStringStart = (maxLength: number) => (string: string) =>
  string.length > maxLength ? '…' + string.substring(maxLength) : string;
export class IotsParseError extends Error {
  public formattedErrors;
  constructor(public originalErrors: t.Errors) {
    const formattedErrors = formatIotsError(originalErrors);
    const errorMsg = JSON.stringify(
      formattedErrors.map(({ expectedType, path, ...error }) => ({
        ...error,
        path: cropStringStart(50)(path),
        expectedType: cropStringEnd(50)(expectedType),
        originalValue:
          'originalValue' in error ? cropStringEnd(50)((error as any).originalValue) : undefined,
      })),
      null,
      2
    );
    super(errorMsg.length > 200 ? errorMsg.substring(0, 200) + '…' : errorMsg);
    this.formattedErrors = formattedErrors;
  }
}

const formatIotsError = (errors: t.Errors) =>
  errors.map((error) => {
    const base = {
      path: error.context.map((c) => c.key || '#root').join('.'),
      expectedType: error.context[error.context.length - 1].type.name,
    };
    const parsedError =
      typeof error.value === 'undefined'
        ? { ...base, originalValueIsUndefined: true }
        : { ...base, originalValue: error.value };
    return parsedError;
  });

const decode =
  <T extends t.Any>(t: T) =>
  (x: unknown): t.TypeOf<T> => {
    const result = t.decode(x);
    if (result._tag === 'Right') return result.right;
    else throw new IotsParseError(result.left);
  };

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
      const axiosOptions: AxiosRequestConfigWithCorrelationId = {
        method: e.method,
        url: `${s.baseUrl}${typeof e.path === 'string' ? e.path : e.path(args)}`,
        headers: { ...s.headers, ...e.headers },
        params: typeof e.params === 'function' ? e.params(args) : e.params,
        paramsSerializer: {
          serialize: (params) => stringify(removeUndefinedProps(params), { arrayFormat: 'repeat' }),
        },
        reqId: reqId++,
      };

      requestLogger(axiosOptions.reqId, e.method, axios.getUri(axiosOptions));

      const promise = axios.request(axiosOptions).then(decode(AxiosResponse(e.body ?? t.unknown)));
      return responseLogger.enabled
        ? (promise
            .then(
              tap((response) => {
                responseLogger(
                  axiosOptions.reqId,
                  '[status]:',
                  `${response.status} ${response.statusText}`
                );
                responseLogger(axiosOptions.reqId, '[headers]:', response.headers);
              })
            )
            .catch((e) => {
              if (e instanceof AxiosError)
                responseLogger(axiosOptions.reqId, 'AxiosError: ' + e.message);
              else if (e instanceof IotsParseError)
                responseLogger(axiosOptions.reqId, 'IotsParseError: ' + e.message);
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
