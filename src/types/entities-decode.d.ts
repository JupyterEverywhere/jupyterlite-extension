declare module 'entities/decode' {
  export type EntityDecoder = (input: string) => string;
  const decode: EntityDecoder;
  export default decode;
}
