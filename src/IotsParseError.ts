import type * as t from 'io-ts';
import { formatIotsError } from './formatIotsError';

const cropStringEnd = (maxLength: number, string: string) =>
  string.length > maxLength ? string.substring(0, maxLength) + '…' : string;
const cropStringStart = (maxLength: number, string: string) =>
  string.length > maxLength ? '…' + string.substring(maxLength) : string;
const hasOriginalValue = <T>(t: T): t is T & { originalValue: unknown } =>
  'originalValue' in (t as any);

class IotsParseError extends Error {
  public formattedErrors;
  constructor(public originalErrors: t.Errors) {
    const formattedErrors = formatIotsError(originalErrors);
    const errorMsg = JSON.stringify(
      formattedErrors.map(({ expectedType, path, ...error }) => ({
        ...error,
        path: cropStringStart(50, path),
        expectedType: cropStringEnd(50, expectedType),
        originalValue: hasOriginalValue(error)
          ? cropStringEnd(50, JSON.stringify(error.originalValue))
          : undefined,
      })),
      null,
      2
    );
    super(errorMsg.length > 200 ? errorMsg.substring(0, 200) + '…' : errorMsg);
    this.formattedErrors = formattedErrors;
  }
}

export default IotsParseError;
