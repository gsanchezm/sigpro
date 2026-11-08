import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// Declara `<sigpro-severity-picker>` para JSX (los atributos se asignan desde el wrapper `SeverityPicker`).
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sigpro-severity-picker': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
