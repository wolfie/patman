import axios, {
  Method as AxiosMethod,
  type AxiosResponse,
  type AxiosRequestConfig,
  AxiosError,
} from 'axios';
import debug from './debug';
import * as t from 'io-ts';
import { stringify } from 'qs';
import { decode, IotsParseError } from './utils';

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const getRandomChars = () =>
  Array(8)
    .fill(undefined)
    .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
    .join('');

const reqIdRef = { current: 0 };
type Enhancement = { reqId: number; transactionLogger: debug.Debugger };
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
    tap(
      (request) =>
        isEnhanced(request) && request.transactionLogger('[req] [headers]:', request.headers)
    )
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

export type Service = {
  baseUrl: string;
  headers?: Record<string, string>;
};

type ParamType = string | number | boolean | undefined;
type Params = Record<string, ParamType | Array<ParamType>>;
type PromiseMaybe<T> = T | Promise<T>;

export type Endpoint<ARGS extends t.Any, BODY extends t.Any> = {
  $args: ARGS;
  $returnBody: BODY;
  method: AxiosMethod;
  path: string | ((args: t.TypeOf<ARGS>) => PromiseMaybe<string>);
  headers?:
    | Record<string, string>
    | ((args: t.TypeOf<ARGS>) => PromiseMaybe<Record<string, string>>);
  params?: Params | ((args: t.TypeOf<ARGS>) => PromiseMaybe<Params>);
};

export const createEndpoint = <ARGS extends t.Any = t.VoidC, BODY extends t.Any = t.UnknownC>(
  options: Omit<Endpoint<ARGS, BODY>, '$args' | '$returnBody'>,
  types?: { args?: ARGS; returnBody?: BODY }
): Endpoint<ARGS, BODY> => ({
  ...options,
  $args: (types?.args ?? t.void) as any,
  $returnBody: (types?.returnBody ?? t.unknown) as any,
});

export const pat =
  <ARGS extends t.Any, BODY extends t.Any>(service: Service, endpoint: Endpoint<ARGS, BODY>) =>
  async (args: t.TypeOf<ARGS>): Promise<AxiosResponse<t.TypeOf<BODY>>> => {
    const reqId = reqIdRef.current++;
    const transactionLogger = logger.extend(`${reqId}.${getRandomChars()}`);

    // These could be parallellized with Promise.all if needed
    const params =
      typeof endpoint.params === 'object' ? endpoint.params : await endpoint.params?.(args);
    const url =
      service.baseUrl +
      (typeof endpoint.path === 'string' ? endpoint.path : await endpoint.path(args));
    const headers = {
      ...service.headers,
      ...(typeof endpoint.headers === 'object' ? endpoint.headers : await endpoint.headers?.(args)),
    };

    const axiosRequestOptions: AxiosRequestEnhanced = {
      method: endpoint.method,
      params,
      url,
      headers,
      paramsSerializer: {
        serialize: (params) => stringify(removeUndefinedProps(params), { arrayFormat: 'repeat' }),
      },
      reqId,
      transactionLogger,
    };

    transactionLogger('[req]', endpoint.method, axios.getUri(axiosRequestOptions));

    const requestPromise = axios
      .request(axiosRequestOptions)
      .then(tap((response) => (response.data = decode(endpoint.$returnBody)(response.data))));

    return transactionLogger.enabled
      ? (requestPromise
          .then(
            tap((response) => {
              transactionLogger('[res]', '[status]:', `${response.status} ${response.statusText}`);
              transactionLogger('[res]', '[headers]:', response.headers);
            })
          )
          .catch((e) => {
            if (e instanceof AxiosError || e instanceof IotsParseError)
              transactionLogger('[res]', e);
            throw e;
          }) as any)
      : requestPromise;
  };

export default pat;
