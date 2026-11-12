import { describe, expect, it } from 'vitest';
import type { PickedFile } from './files';
import { appendEvidence, buildRunForm, type FormSink } from './upload';

const recorder = (): { readonly sink: FormSink; readonly calls: { name: string; value: unknown; fileName?: string }[] } => {
  const calls: { name: string; value: unknown; fileName?: string }[] = [];
  return { calls, sink: { append: (name, value, fileName) => void calls.push({ name, value, ...(fileName === undefined ? {} : { fileName }) }) } };
};

const picked = (overrides: Partial<PickedFile> = {}): PickedFile => ({ uri: 'file:///cache/captura.png', name: 'captura.png', mimeType: 'image/png', size: 67, ...overrides });

describe('appendEvidence en nativo', () => {
  it('adjunta una parte { uri, name, type } que React Native lee del disco al enviar', async () => {
    const { sink, calls } = recorder();
    await appendEvidence(sink, picked(), { isWeb: false });
    expect(calls).toEqual([{ name: 'files', value: { uri: 'file:///cache/captura.png', name: 'captura.png', type: 'image/png' } }]);
  });

  it('sin tipo conocido usa un tipo genérico (el servidor decide por la firma del archivo)', async () => {
    const { sink, calls } = recorder();
    await appendEvidence(sink, picked({ mimeType: '' }), { isWeb: false });
    expect(calls[0]?.value).toMatchObject({ type: 'application/octet-stream' });
  });
});

describe('appendEvidence en la web', () => {
  it('adjunta el File que entregó el selector, con su nombre, sin descargar nada', async () => {
    const { sink, calls } = recorder();
    const file = new Blob(['png'], { type: 'image/png' });
    let fetched = false;
    await appendEvidence(sink, picked({ file }), {
      isWeb: true,
      fetchBlob: () => {
        fetched = true;
        return Promise.resolve(new Blob());
      },
    });
    expect(fetched).toBe(false);
    expect(calls).toEqual([{ name: 'files', value: file, fileName: 'captura.png' }]);
  });

  it('sin File, descarga el blob: del selector', async () => {
    const { sink, calls } = recorder();
    const blob = new Blob(['png'], { type: 'image/png' });
    const seen: string[] = [];
    await appendEvidence(sink, picked({ uri: 'blob:http://localhost/abc' }), {
      isWeb: true,
      fetchBlob: (uri) => {
        seen.push(uri);
        return Promise.resolve(blob);
      },
    });
    expect(seen).toEqual(['blob:http://localhost/abc']);
    expect(calls[0]).toMatchObject({ name: 'files', value: blob, fileName: 'captura.png' });
  });

  it('corrige un blob sin tipo con el tipo resuelto del archivo', async () => {
    const { sink, calls } = recorder();
    await appendEvidence(sink, picked({ file: new Blob(['x']) }), { isWeb: true });
    expect((calls[0]?.value as Blob).type).toBe('image/png');
  });
});

describe('buildRunForm', () => {
  it('arma el multipart con result, notes y los archivos en orden (Node tiene FormData y Blob)', async () => {
    const files = [picked({ name: 'a.png', file: new Blob(['a'], { type: 'image/png' }) }), picked({ name: 'b.pdf', mimeType: 'application/pdf', file: new Blob(['b'], { type: 'application/pdf' }) })];
    const form = await buildRunForm({ result: 'blocked', notes: 'sin entorno' }, files, { isWeb: true });
    expect(form.get('result')).toBe('blocked');
    expect(form.get('notes')).toBe('sin entorno');
    const sent = form.getAll('files');
    expect(sent).toHaveLength(2);
    expect(sent.map((part) => (part as File).name)).toEqual(['a.png', 'b.pdf']);
    expect((sent[1] as File).type).toBe('application/pdf');
  });

  it('sin archivos solo lleva los campos de texto', async () => {
    const form = await buildRunForm({ result: 'pass', notes: '' }, [], { isWeb: false });
    expect(form.get('result')).toBe('pass');
    expect(form.get('notes')).toBe('');
    expect(form.getAll('files')).toHaveLength(0);
  });
});
