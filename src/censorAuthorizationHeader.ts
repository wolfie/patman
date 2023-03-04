import { AxiosHeaders } from 'axios';

const censorAuthorizationHeader = (headers: AxiosHeaders): AxiosHeaders => {
  if (!headers.hasAuthorization()) return headers;

  const copy = new AxiosHeaders(headers);
  const authString = String(copy.getAuthorization()); // axios type doc is wrong
  const spacePos = authString.indexOf(' ');
  const censoredString = authString.substring(0, spacePos + 3).padEnd(authString.length, '*');
  copy.setAuthorization(censoredString, true);
  return copy;
};

export default censorAuthorizationHeader;
