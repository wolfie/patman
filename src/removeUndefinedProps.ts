const removeUndefinedProps = <T>(t: Record<string, T | undefined>): Record<string, T> =>
  Object.fromEntries(Object.entries(t).filter(([_, value]) => typeof value !== 'undefined')) as any;

export default removeUndefinedProps;
