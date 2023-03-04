const tap =
  <T>(tapper: (t: T) => void) =>
  (t: T): T => {
    tapper(t);
    return t;
  };

export default tap;
