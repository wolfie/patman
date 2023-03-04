import IotsParseError from './IotsParseError';

const handleIotsParseError =
  <T>(fallbackValue: T) =>
  (e: unknown): T => {
    if (e instanceof IotsParseError) return fallbackValue;
    else throw e;
  };

export default handleIotsParseError;
