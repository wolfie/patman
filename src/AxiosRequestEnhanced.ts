import type { AxiosRequestConfig } from 'axios';

type Enhancement = { reqId: number; transactionLogger: debug.Debugger };
type AxiosRequestEnhanced = AxiosRequestConfig & Enhancement;
export const isEnhanced = <T>(config: T): config is T & Enhancement =>
  typeof (config as any)['reqId'] === 'number';

export default AxiosRequestEnhanced;
