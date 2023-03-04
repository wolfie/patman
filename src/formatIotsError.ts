import type * as t from 'io-ts';

export const formatIotsError = (errors: t.Errors) =>
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
