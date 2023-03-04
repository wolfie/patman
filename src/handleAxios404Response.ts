import { isAxiosError } from 'axios';

const handleAxios404Response =
  <T>(fallbackValue: T) =>
  (e: unknown) => {
    if (isAxiosError(e) && e.response?.status === 404) {
      return fallbackValue;
    } else throw e;
  };

export default handleAxios404Response;
