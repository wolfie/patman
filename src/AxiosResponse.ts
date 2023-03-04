import * as t from 'io-ts';

const AxiosResponse = <T extends t.Any>(data: T) =>
  t.type({
    data,
    status: t.number,
    statusText: t.string,
    headers: t.UnknownRecord,
    config: t.UnknownRecord,
  });

export default AxiosResponse;
