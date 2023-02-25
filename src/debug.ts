import type { Debug, Debugger } from 'debug';

const mockedDebug: Debug = ((): Debugger => {
  const mockedDebugger: Debugger = (() => {}) as unknown as Debugger;
  mockedDebugger.enabled = false;
  mockedDebugger.extend = () => mockedDebugger;
  return mockedDebugger;
}) as unknown as Debug;

let debug = mockedDebug;
try {
  debug = require('debug');
} catch (e) {
  // noop
}
export default debug;
