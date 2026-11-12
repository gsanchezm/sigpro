import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../state/i18n';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Screen } from './Screen';
import { Text } from './Text';

interface Props {
  /** Título de la pantalla (el del módulo). */
  readonly title: string;
  /** Raíz de la pantalla: distinta de la del módulo, que la web solo pinta con permiso. */
  readonly pageTestID: string;
  /** Aviso (`role="alert"`) con el título del rechazo, su explicación y el enlace de vuelta. */
  readonly noticeTestID: string;
  readonly heading: string;
  readonly body: string;
  readonly backTestID: string;
}

/** Pantalla de un módulo al que el rol no tiene acceso (el `alert-warn` de la web): explicación y «Volver a Programas». */
export const ForbiddenScreen = ({ title, pageTestID, noticeTestID, heading, body, backTestID }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Screen title={title} testID={pageTestID}>
      <View role="alert" testID={noticeTestID} style={[styles.notice, { backgroundColor: colors.warnSoft, borderColor: colors.warn }]}>
        <Text variant="heading" style={{ color: colors.warn }}>
          {heading}
        </Text>
        <Text variant="body">{body}</Text>
        <Link href="/programs" asChild>
          <Pressable role="link" testID={backTestID} style={styles.back}>
            <Text variant="label" tone="accent">
              {t('common', 'backToPrograms')}
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 6 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
