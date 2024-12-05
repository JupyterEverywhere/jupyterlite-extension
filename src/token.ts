import { hasRequiredKeys } from './validator';

export interface IToken {
  token: string;
}

export function validateToken(data: unknown): data is IToken {
  return (
    hasRequiredKeys<IToken, keyof IToken>(data, ['token']) &&
    typeof (data as IToken).token === 'string'
  );
}
