import { void as tVoid, unknown as tUnknown } from 'io-ts';
import type * as t from 'io-ts';
import type Endpoint from './Endpoint';

const createEndpoint = <ARGS extends t.Any = t.VoidC, BODY extends t.Any = t.UnknownC>(
  options: Omit<Endpoint<ARGS, BODY>, '$args' | '$returnBody'>,
  types?: { args?: ARGS; returnBody?: BODY }
): Endpoint<ARGS, BODY> => ({
  ...options,
  $args: (types?.args ?? tVoid) as any,
  $returnBody: (types?.returnBody ?? tUnknown) as any,
});

export default createEndpoint;
