import { describe, expect, it } from 'vitest';
import { richTextToPlain, sanitizeRichText } from './richtext';

describe('sanitizeRichText', () => {
  it('conserva el formato permitido sin atributos', () => {
    expect(sanitizeRichText('<p>Hola <strong>mundo</strong> y <em>más</em></p>')).toBe('<p>Hola <strong>mundo</strong> y <em>más</em></p>');
    expect(sanitizeRichText('<ul><li>uno</li><li>dos</li></ul>')).toBe('<ul><li>uno</li><li>dos</li></ul>');
    expect(sanitizeRichText('a<br>b<br/>c')).toBe('a<br>b<br>c');
  });

  it('normaliza lo que genera execCommand: b → strong, i → em, div → p', () => {
    expect(sanitizeRichText('<div><b>negrita</b> <i>cursiva</i></div>')).toBe('<p><strong>negrita</strong> <em>cursiva</em></p>');
  });

  it('elimina atributos, enlaces y manejadores de eventos', () => {
    expect(sanitizeRichText('<p onclick="alert(1)" style="color:red">hola</p>')).toBe('<p>hola</p>');
    expect(sanitizeRichText('<a href="javascript:alert(1)">pulsa</a>')).toBe('pulsa');
    expect(sanitizeRichText('<img src=x onerror=alert(1)>texto')).toBe('texto');
  });

  it('descarta el contenido de script, style e iframe', () => {
    expect(sanitizeRichText('antes<script>alert(1)</script>después')).toBe('antesdespués');
    expect(sanitizeRichText('<style>p{display:none}</style><p>visible</p>')).toBe('<p>visible</p>');
    expect(sanitizeRichText('<iframe src="x">oculto</iframe>fin')).toBe('fin');
  });

  it('escapa el texto suelto y no rompe las entidades existentes', () => {
    expect(sanitizeRichText('a < b && c > d')).toBe('a &lt; b &amp;&amp; c &gt; d');
    expect(sanitizeRichText('Tom &amp; Jerry &lt;3')).toBe('Tom &amp; Jerry &lt;3');
  });

  it('equilibra las etiquetas abiertas y descarta cierres sin pareja', () => {
    expect(sanitizeRichText('<p><strong>abierto')).toBe('<p><strong>abierto</strong></p>');
    expect(sanitizeRichText('texto</strong></p>')).toBe('texto');
    expect(sanitizeRichText('<ul><li>a<ul><li>b')).toBe('<ul><li>a<ul><li>b</li></ul></li></ul>');
  });

  it('es idempotente', () => {
    const once = sanitizeRichText('<div><b>x</b> <script>1</script>&nbsp;y</div>');
    expect(sanitizeRichText(once)).toBe(once);
  });

  it('un texto plano queda igual', () => {
    expect(sanitizeRichText('Requisito sin formato')).toBe('Requisito sin formato');
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('richTextToPlain', () => {
  it('quita etiquetas, decodifica entidades y colapsa espacios', () => {
    expect(richTextToPlain('<p>Uno</p><p>Dos &amp; tres</p><ul><li>a</li><li>b</li></ul>')).toBe('Uno Dos & tres a b');
    expect(richTextToPlain('línea<br>siguiente')).toBe('línea siguiente');
  });
});
