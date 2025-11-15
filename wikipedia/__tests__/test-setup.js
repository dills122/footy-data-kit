import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { Blob } from 'node:buffer';

if (typeof globalThis.ReadableStream === 'undefined') globalThis.ReadableStream = ReadableStream;
if (typeof globalThis.WritableStream === 'undefined') globalThis.WritableStream = WritableStream;
if (typeof globalThis.TransformStream === 'undefined') globalThis.TransformStream = TransformStream;
if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob;
if (typeof globalThis.File === 'undefined') globalThis.File = class File {};
if (typeof globalThis.FormData === 'undefined') globalThis.FormData = class FormData {};
if (typeof globalThis.DOMException === 'undefined') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'DOMException') {
      super(message);
      this.name = name;
    }
  };
}
