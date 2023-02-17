import axios, { AxiosResponse, Method as AxiosMethod } from "axios";

type ServerConfig = {
  /** e.g. https://dummy.restapiexample.com/api/v1 */
  baseUrl: string;
  headers?: Record<string, string>;
};

type ServiceConfigWithoutDev = { readonly prod: ServerConfig };
type ServiceConfigWithDev = ServiceConfigWithoutDev & {
  readonly dev: ServerConfig;
};
type ServiceConfig = ServiceConfigWithDev | ServiceConfigWithoutDev;

type Service<HAS_DEV extends boolean> =
  | {
      hasDev: false;
      config: ServiceConfigWithoutDev;
    }
  | ({
      hasDev: true;
      config: ServiceConfigWithDev;
    } & { hasDev: HAS_DEV });

type CallFn = () => Promise<AxiosResponse<unknown, unknown>>;

type Endpoint<NAME extends string, HAS_DEV extends boolean> = {
  readonly name: NAME;
  callProd: CallFn;
} & (
  | { readonly hasDev: false }
  | { readonly hasDev: true; callDev: CallFn }
) & { readonly hasDev: HAS_DEV };

type HasDev<T> = T extends { dev: ServerConfig } ? true : false;

const createService = <T extends ServiceConfig>(
  serviceConfig: T
): Service<HasDev<T>> => {
  return {
    hasDev: ("dev" in serviceConfig) as any,
    config: serviceConfig,
  };
};

const createCall =
  (method: AxiosMethod, path: string, config: ServerConfig) => () =>
    axios.request({
      method,
      url: `${config.baseUrl}/${path}`,
      headers: config.headers,
    });

const serviceHasDev = <SERVICE extends Service<any>>(
  service: SERVICE
): service is SERVICE & { hasDev: true } => service.hasDev;

const createEndpoint = <NAME extends string, HAS_DEV extends boolean>(
  service: Service<HAS_DEV>,
  name: NAME,
  method: AxiosMethod,
  path: string
): Endpoint<NAME, HAS_DEV> => {
  const base = {
    name,
    callProd: createCall(method, path, service.config.prod),
  } satisfies Pick<Endpoint<NAME, any>, "name" | "callProd">;

  return (
    serviceHasDev(service)
      ? ({
          ...base,
          hasDev: service.hasDev,
          callDev: createCall(method, path, service.config.dev),
        } satisfies Endpoint<NAME, true>)
      : ({
          ...base,
          hasDev: service.hasDev,
        } satisfies Endpoint<NAME, false>)
  ) as any;
};

const service = createService({
  prod: { baseUrl: "https://dummy.restapiexample.com/api/v1" },
  dev: { baseUrl: "https://dummy.restapiexample.com/api/v1" },
});

const endpoint = createEndpoint(service, "employees", "GET", "/employees");

endpoint.callProd().then((response) => console.log(response.data));
endpoint.callDev().then((response) => console.log(response.data));
