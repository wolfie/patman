import * as t from 'io-ts';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { stringify } from 'qs';
import AxiosRequestEnhanced, { isEnhanced } from './AxiosRequestEnhanced';
import censorAuthorizationHeader from './censorAuthorizationHeader';
import createRandomChars from './createRandomChars';
import decode from './decode';
import Endpoint from './Endpoint';
import IotsParseError from './IotsParseError';
import logger from './logger';
import removeUndefinedProps from './removeUndefinedProps';
import Service from './Service';
import tap from './tap';

if (logger.enabled) {
  axios.interceptors.request.use(
    tap(
      (request) =>
        isEnhanced(request) &&
        request.transactionLogger(
          '[req] [headers]: %j',
          process.env.SHOW_AUTH_HEADERS
            ? request.headers
            : censorAuthorizationHeader(request.headers)
        )
    )
  );
}

const reqIdRef = { current: 0 };

const createCallFunction =
  <ARGS extends t.Any, BODY extends t.Any>(service: Service, endpoint: Endpoint<ARGS, BODY>) =>
  async (args: t.TypeOf<ARGS>): Promise<AxiosResponse<t.TypeOf<BODY>>> => {
    const reqId = reqIdRef.current++;
    const transactionLogger = logger.extend(`${reqId}.${createRandomChars()}`);

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

    transactionLogger('[req] %s %s', endpoint.method, axios.getUri(axiosRequestOptions));

    const requestPromise = axios
      .request(axiosRequestOptions)
      .then(tap((response) => (response.data = decode(endpoint.$returnBody, response.data))));

    return transactionLogger.enabled
      ? (requestPromise
          .then(
            tap((response) => {
              transactionLogger('[res] [status]: %s %s', response.status, response.statusText);
              transactionLogger('[res] [headers]: %j', response.headers);
              transactionLogger('[res] [body]: %O', response.data);
            })
          )
          .catch((e) => {
            if (e instanceof AxiosError || e instanceof IotsParseError)
              transactionLogger('[res] %s: %s', e.name, e.message);
            throw e;
          }) as any)
      : requestPromise;
  };

export default createCallFunction;
