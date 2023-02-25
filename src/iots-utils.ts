import * as t from 'io-ts';

const formatIotsError = (errors: t.Errors) =>
  errors.map((error) => {
    const base = {
      path: error.context.map((c) => c.key || '#root').join('.'),
      expectedType: error.context[error.context.length - 1].type.name,
    };
    const parsedError =
      typeof error.value === 'undefined'
        ? { ...base, originalValueIsUndefined: true }
        : { ...base, originalValue: error.value };
    return parsedError;
  });

export const decode =
  <T extends t.Any>(t: T) =>
  (x: unknown): t.TypeOf<T> => {
    const result = t.decode(x);
    if (result._tag === 'Right') return result.right;
    else throw new IotsParseError(result.left);
  };

const cropStringEnd = (maxLength: number) => (string: string) =>
  string.length > maxLength ? string.substring(0, maxLength) + '…' : string;
const cropStringStart = (maxLength: number) => (string: string) =>
  string.length > maxLength ? '…' + string.substring(maxLength) : string;

export class IotsParseError extends Error {
  public formattedErrors;
  constructor(public originalErrors: t.Errors) {
    const formattedErrors = formatIotsError(originalErrors);
    const errorMsg = JSON.stringify(
      formattedErrors.map(({ expectedType, path, ...error }) => ({
        ...error,
        path: cropStringStart(50)(path),
        expectedType: cropStringEnd(50)(expectedType),
        originalValue:
          'originalValue' in error ? cropStringEnd(50)((error as any).originalValue) : undefined,
      })),
      null,
      2
    );
    super(errorMsg.length > 200 ? errorMsg.substring(0, 200) + '…' : errorMsg);
    this.formattedErrors = formattedErrors;
  }
}
