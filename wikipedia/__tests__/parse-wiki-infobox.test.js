import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { Blob } from 'node:buffer';
import parseInfobox from '../parse-wiki-infobox.js';

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = WritableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = TransformStream;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}
if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = class FormData {};
}
if (typeof globalThis.DOMException === 'undefined') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'DOMException') {
      super(message);
      this.name = name;
    }
  };
}

describe('parseInfobox', () => {
  test('extracts season metadata including relegated, new clubs, folded and resigned', async () => {
    const html = `
      <table class="infobox">
        <caption class="infobox-title"><a>The Football League</a></caption>
        <tbody>
          <tr><th>Season</th><td>1900–01</td></tr>
          <tr><th>Relegated</th><td><a>Club A</a>, <a>Club B</a></td></tr>
          <tr><th>New Clubs in League</th><td><a>Newcomer</a></td></tr>
          <tr><th>Folded</th><td><a>Folded FC</a></td></tr>
          <tr><th>Resigned</th><td><a>Resigned Town</a></td></tr>
        </tbody>
      </table>
    `;

    const result = await parseInfobox(html);
    expect(result.season).toBe('1900–01');
    expect(result.relegated).toEqual(['Club A', 'Club B']);
    expect(result.newClubs).toEqual(['Newcomer']);
    expect(result.folded).toEqual(['Folded FC']);
    expect(result.resigned).toEqual(['Resigned Town']);
  });

  test('returns empty fields when no matching infobox exists', async () => {
    const html = '<table class="infobox"><caption>Other</caption></table>';
    const result = await parseInfobox(html);
    expect(result).toEqual({ season: '', relegated: [], newClubs: [], folded: [], resigned: [] });
  });
});
