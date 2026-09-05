/* Minimal ambient module declarations to satisfy TypeScript during build.
   These are temporary until proper `@types/*` packages are installed. */

declare module 'marked' {
  export function parse(src: string, options?: any): string;
  export function lexer(src: string, options?: any): any;
  export function parseInline(src: string, options?: any): any;
  const marked: any;
  export default marked;
}

declare module 'dompurify' {
  const DOMPurify: any;
  export default DOMPurify;
}
