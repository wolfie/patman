const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const createRandomChars = (length = 8) =>
  Array(length)
    .fill(undefined)
    .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
    .join('');

export default createRandomChars;
