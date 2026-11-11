// React Native Web acepta `dataSet` (se pinta como `data-*` en el DOM: `dataSet={{ state: 'open' }}` → `data-state="open"`)
// pero los tipos de React Native no lo conocen. En nativo la propiedad simplemente se ignora.
import 'react-native';

declare module 'react-native' {
  type DataSet = Readonly<Record<string, string | number | boolean | undefined>>;
  interface ViewProps {
    dataSet?: DataSet;
  }
  interface TextProps {
    dataSet?: DataSet;
  }
  interface TextInputProps {
    dataSet?: DataSet;
  }
  interface ImagePropsBase {
    dataSet?: DataSet;
  }
}
