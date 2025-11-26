declare module 'bs58' {
  export function decode(encoded: string): Uint8Array;
  export function encode(data: Uint8Array | Buffer | number[]): string;
  
  const bs58: {
    decode(encoded: string): Uint8Array;
    encode(data: Uint8Array | Buffer | number[]): string;
  };
  
  export default bs58;
}

