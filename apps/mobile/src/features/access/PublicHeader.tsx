import { LANGS, type Lang } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Button } from '../../ui/Button';
import { SelectField, type SelectOption } from '../../ui/SelectField';
import { Text } from '../../ui/Text';

const LANG_OPTIONS: readonly SelectOption<Lang>[] = LANGS.map((code) => ({ value: code, label: code.toUpperCase() }));

interface Props {
  /** Ids de la web del selector de idioma y del botón de tema (`auth-lang`/`auth-theme` o `legal-lang`/`legal-theme`). */
  readonly langTestID: string;
  readonly themeTestID: string;
  /** Nombres accesibles (los de la web: «Idioma» y «Cambiar tema» de `acceso` o de `legal`). */
  readonly langLabel: string;
  readonly themeLabel: string;
}

/** Cabecera de las pantallas públicas (Acceso, términos, privacidad y ayuda): marca, idioma y tema, sin necesidad de sesión. */
export const PublicHeader = ({ langTestID, themeTestID, langLabel, themeLabel }: Props) => {
  const { lang, setLang } = useI18n();
  const { scheme, toggleTheme } = useTheme();
  return (
    <View style={styles.top}>
      <Text variant="heading" tone="accent">
        SIGPRO
      </Text>
      <View style={styles.tools}>
        <View style={styles.lang}>
          <SelectField label={langLabel} value={lang} options={LANG_OPTIONS} onChange={setLang} testID={langTestID} />
        </View>
        <Button label={themeLabel} testID={themeTestID} variant="ghost" onPress={toggleTheme} accessibilityLabel={`${themeLabel} (${scheme})`} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  tools: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  lang: { width: 92 },
});
