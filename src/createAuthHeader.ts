const createAuthHeader = (
  user: string,
  pass: string
): Record<'Authorization', `Basic ${string}`> => ({
  Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
});

export default createAuthHeader;
