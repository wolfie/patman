import type * as t from 'io-ts';
import type { Method as AxiosMethod } from 'axios';

type ParamType = string | number | boolean | undefined;
type Params = Record<string, ParamType | Array<ParamType>>;
type PromiseMaybe<T> = T | Promise<T>;

type Endpoint<ARGS extends t.Any, BODY extends t.Any> = {
  $args: ARGS;
  $returnBody: BODY;
  method: AxiosMethod;
  path: string | ((args: t.TypeOf<ARGS>) => PromiseMaybe<string>);
  headers?:
    | Record<string, string>
    | ((args: t.TypeOf<ARGS>) => PromiseMaybe<Record<string, string>>);
  params?: Params | ((args: t.TypeOf<ARGS>) => PromiseMaybe<Params>);
};

export default Endpoint;
