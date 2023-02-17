import axios, { AxiosResponse, Method as AxiosMethod } from 'axios';

type ServerConfig = {
  /** e.g. https://dummy.restapiexample.com/api/v1 */
  baseUrl: string;
  headers?: Record<string, string>;
};

type ServiceConfigWithoutDev = { readonly prod: ServerConfig };
type ServiceConfigWithDev = ServiceConfigWithoutDev & {
  readonly dev: ServerConfig;
};

type Endpoint = {
  method: AxiosMethod;
  path: string;
  params?: Record<string, string | string[]>;
};

type ServiceConfig = ServiceConfigWithDev | ServiceConfigWithoutDev;
type HasDev<T> = T extends ServiceConfigWithDev ? true : false;
const hasDev = (config: ServiceConfig): config is ServiceConfigWithDev => 'dev' in config;

type EnvWithoutDev<ENDPOINT extends string> = {
  prod: Record<ENDPOINT, CallFn>;
};
type EnvWithDev<ENDPOINT extends string> = {
  prod: Record<ENDPOINT, CallFn>;
  dev: Record<ENDPOINT, CallFn>;
};

type EndpointWithoutDev<ENDPOINT extends string> = Record<ENDPOINT, { prod: CallFn }>;
type EndpointWithDev<ENDPOINT extends string> = Record<ENDPOINT, { prod: CallFn; dev: CallFn }>;
type Service<HAS_DEV extends boolean, ENDPOINT extends string> = (
  | {
      readonly hasDev: false;
      env: EnvWithoutDev<ENDPOINT>;
      endpoint: EndpointWithoutDev<ENDPOINT>;
    }
  | {
      readonly hasDev: true;
      env: EnvWithDev<ENDPOINT>;
      endpoint: EndpointWithDev<ENDPOINT>;
    }
) & { readonly hasDev: HAS_DEV };

type CallFn = () => Promise<AxiosResponse<unknown, unknown>>;
type Keyof<T> = T extends Record<infer K, any> ? K : never;

const mapValues = <T extends Record<any, any>, K>(
  o: T,
  mapper: (value: T[keyof T]) => K
): Record<Keyof<T>, K> =>
  Object.fromEntries(Object.entries(o).map((entry) => [entry[0], mapper(entry[1])])) as any;

const createService = <CONFIG extends ServiceConfig, ENDPOINTS extends Record<string, Endpoint>>(
  serviceConfig: CONFIG,
  endpoints: ENDPOINTS
): Service<HasDev<CONFIG>, Keyof<ENDPOINTS>> => {
  const createCallFn =
    ({ baseUrl }: ServerConfig) =>
    ({ path, method }: Endpoint) =>
    () =>
      axios.request({
        method,
        url: `${baseUrl}/${path}`,
      });

  const prodCallFn = createCallFn(serviceConfig.prod);

  if (hasDev(serviceConfig)) {
    const devCallFn = createCallFn(serviceConfig.dev);
    const env = {
      prod: mapValues(endpoints, (endpoint) => prodCallFn(endpoint)),
      dev: mapValues(endpoints, (endpoint) => devCallFn(endpoint)),
    } satisfies EnvWithDev<Keyof<ENDPOINTS>>;

    const endpoint = mapValues(endpoints, (endpoint) => ({
      prod: prodCallFn(endpoint),
      dev: devCallFn(endpoint),
    }));

    const serviceWithDev = {
      hasDev: true,
      env,
      endpoint,
    } satisfies Service<true, Keyof<ENDPOINTS>>;

    return serviceWithDev as any;
  } else {
    const env = {
      prod: mapValues(endpoints, (endpoint) => prodCallFn(endpoint)),
    } satisfies EnvWithoutDev<Keyof<ENDPOINTS>>;

    const endpoint = mapValues(endpoints, (endpoint) => ({
      prod: prodCallFn(endpoint),
    }));

    const serviceWithoutDev = {
      hasDev: false,
      env,
      endpoint,
    } satisfies Service<false, Keyof<ENDPOINTS>>;

    return serviceWithoutDev as any;
  }
};

const service = createService(
  {
    prod: { baseUrl: 'https://dummy.restapiexample.com/api/v1' },
    // dev: { baseUrl: 'https://dummy.restapiexample.com/api/v1' },
  },
  {
    employees: { method: 'GET', path: '/employees' },
    employee: { method: 'GET', path: '/employee/1' },
  }
);

service.env.prod.employees().then((response) => console.log(response.data));
service.endpoint.employees.prod().then((response) => console.log(response.data));
