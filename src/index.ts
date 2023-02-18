import axios, { AxiosResponse, Method as AxiosMethod } from 'axios';
import * as t from 'io-ts';

type ServerConfig = {
  /** e.g. https://dummy.restapiexample.com/api/v1 */
  baseUrl: string;
  headers?: Record<string, string>;
};

type ServiceConfigWithoutDev = { readonly prod: ServerConfig };
type ServiceConfigWithDev = ServiceConfigWithoutDev & {
  readonly dev: ServerConfig;
};

type Path<ARGS extends t.TypeC<any>> = (args: t.TypeOf<ARGS>) => string;
type Params<ARGS extends t.TypeC<any>> = (
  args: t.TypeOf<ARGS>
) => Record<string, string | string[]>;

type Endpoint<ARGS> = ARGS extends Void
  ? {
      method: AxiosMethod;
      args: Void;
      path: string;
      params?: Record<string, string | string[]>;
    }
  : ARGS extends t.TypeC<any>
  ? {
      method: AxiosMethod;
      args: ARGS;
      path: Path<ARGS>;
      params?: Params<ARGS>;
    }
  : never;

function endpoint<ARGS extends t.TypeC<any>>(
  args: ARGS
): <OPTS extends { method: AxiosMethod; path: Path<ARGS>; params?: Params<ARGS> }>(
  options: OPTS
) => { args: ARGS } & OPTS;
function endpoint(args?: undefined): <
  OPTS extends {
    method: AxiosMethod;
    path: string;
    params?: Record<string, string | string[]>;
  }
>(
  options: OPTS
) => { args: Void } & OPTS;
function endpoint(args: any) {
  return (options: any) => ({
    args,
    ...options,
  });
}

type ServiceConfig = ServiceConfigWithDev | ServiceConfigWithoutDev;
type HasDev<T> = T extends ServiceConfigWithDev ? true : false;
const hasDev = (config: ServiceConfig): config is ServiceConfigWithDev => 'dev' in config;

const Void = Symbol('void');
type Void = typeof Void;

type EnvWithoutDev<ENDPOINT extends Record<string, string | number | Void>> = {
  prod: { [K in keyof ENDPOINT]: CallFn<ENDPOINT[K]> };
};
type EnvWithDev<ENDPOINT extends Record<string, string | number | Void>> = {
  prod: { [K in keyof ENDPOINT]: CallFn<ENDPOINT[K]> };
  dev: { [K in keyof ENDPOINT]: CallFn<ENDPOINT[K]> };
};

type EndpointWithoutDev<ENDPOINT extends Record<string, string | number | Void>> = {
  [K in keyof ENDPOINT]: { prod: CallFn<ENDPOINT[K]> };
};
type EndpointWithDev<ENDPOINT extends Record<string, string | number | Void>> = {
  [K in keyof ENDPOINT]: { prod: CallFn<ENDPOINT[K]>; dev: CallFn<ENDPOINT[K]> };
};
type Service<HAS_DEV extends boolean, ENDPOINTS extends Record<string, string | number | Void>> = (
  | {
      readonly hasDev: false;
      env: EnvWithoutDev<ENDPOINTS>;
      endpoint: EndpointWithoutDev<ENDPOINTS>;
    }
  | {
      readonly hasDev: true;
      env: EnvWithDev<ENDPOINTS>;
      endpoint: EndpointWithDev<ENDPOINTS>;
    }
) & { readonly hasDev: HAS_DEV };

type CallFn<ARGS> = ARGS extends Record<any, any>
  ? (args: ARGS) => Promise<AxiosResponse>
  : () => Promise<AxiosResponse>;

const mapValues = <T extends Record<any, any>, K>(
  o: T,
  mapper: (value: T[keyof T]) => K
): Record<keyof T, K> =>
  Object.fromEntries(Object.entries(o).map((entry) => [entry[0], mapper(entry[1])])) as any;

type ArgOf<ENDPOINT> = ENDPOINT extends Endpoint<infer U>
  ? t.TypeOf<U extends t.Any ? U : t.VoidC>
  : void;
type EndsToArgs<ENDPOINTS extends Record<string, Endpoint<any>>> = {
  [K in keyof ENDPOINTS]: ArgOf<ENDPOINTS[K]>;
};

const createService = <
  CONFIG extends ServiceConfig,
  ENDPOINTS extends Record<string, Endpoint<any>>
>(
  serviceConfig: CONFIG,
  endpoints: ENDPOINTS
): Service<HasDev<CONFIG>, EndsToArgs<ENDPOINTS>> => {
  const createCallFn =
    ({ baseUrl }: ServerConfig) =>
    ({ path, method, params }: Endpoint<any>): CallFn<any> =>
    (args) =>
      axios.request({
        method,
        url: `${baseUrl}${typeof path === 'string' ? path : path(args)}`,
        params: typeof params === 'function' ? params(args) : params,
        // headers: '',
      });

  const prodCallFn = createCallFn(serviceConfig.prod);

  if (hasDev(serviceConfig)) {
    const devCallFn = createCallFn(serviceConfig.dev);
    const env = {
      prod: mapValues(endpoints, (endpoint) => prodCallFn(endpoint)) as any,
      dev: mapValues(endpoints, (endpoint) => devCallFn(endpoint)) as any,
    } satisfies EnvWithDev<EndsToArgs<ENDPOINTS>>;

    const endpoint = mapValues(endpoints, (endpoint) => ({
      prod: prodCallFn(endpoint),
      dev: devCallFn(endpoint),
    })) as EndpointWithDev<EndsToArgs<ENDPOINTS>>;

    const serviceWithDev = {
      hasDev: true,
      env,
      endpoint,
    } satisfies Service<true, EndsToArgs<ENDPOINTS>>;

    return serviceWithDev as any;
  } else {
    const env = {
      prod: mapValues(endpoints, (endpoint) => prodCallFn(endpoint)) as any,
    } satisfies EnvWithoutDev<EndsToArgs<ENDPOINTS>>;

    const endpoint = mapValues(endpoints, (endpoint) => ({
      prod: prodCallFn(endpoint),
    })) as EndpointWithoutDev<EndsToArgs<ENDPOINTS>>;

    const serviceWithoutDev = {
      hasDev: false,
      env,
      endpoint,
    } satisfies Service<false, EndsToArgs<ENDPOINTS>>;

    return serviceWithoutDev as any;
  }
};

const service = createService(
  {
    prod: { baseUrl: 'https://baconipsum.com/api' },
    // dev: { baseUrl: 'https://dummy.restapiexample.com/api/v1' },
  },
  {
    bacon: endpoint()({
      method: 'GET',
      path: '/?type=meat-and-filler',
    }),
    baconAllMeat: endpoint(
      t.type({ type: t.union([t.literal('all-meat'), t.literal('meat-and-filler')]) })
    )({
      method: 'GET',
      path: ({ type }) => `/?type=${type}`,
    }),
  }
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  // await service.env.prod.employees().then((response) => console.log(response.data));
  // await sleep(1000);
  // await service.endpoint.employees.prod().then((response) => console.log(response.data));
  await service.endpoint.bacon.prod().then((response) => console.log(response.data));
  await service.endpoint.baconAllMeat
    .prod({ type: 'all-meat' })
    .then((response) => console.log(response.data));
})();
