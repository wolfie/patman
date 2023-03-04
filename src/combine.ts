import type { AxiosResponse } from 'axios';
import type * as t from 'io-ts';
import type Endpoint from './Endpoint';
import type Service from './Service';
import createCallFunction from './createCallFunction';

type CallerOf<T> = T extends Endpoint<infer ARGS, infer BODY>
  ? (args: t.TypeOf<ARGS>) => Promise<AxiosResponse<t.TypeOf<BODY>>>
  : never;
type CallersOf<T extends Record<string, Endpoint<any, any>>> = {
  [P in keyof T]: CallerOf<T[P]>;
};

const combine = <S extends Record<string, Service>, E extends Record<string, Endpoint<any, any>>>(
  services: S,
  endpoints: E
): Record<keyof S, CallersOf<E>> => {
  const envEntries = Object.entries(services);
  const endpointEntries = Object.entries(endpoints);
  return Object.fromEntries(
    envEntries.map(([envName, env]) => [
      envName,
      Object.fromEntries(
        endpointEntries.map(([endName, end]) => [endName, createCallFunction(env, end)])
      ),
    ])
  ) as any;
};

export default combine;
