import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACCESO_DYNAMIC_TESTIDS } from '@sigpro/shared';
import { Text } from '../ui/Text';
import { RADIUS, toneColors, type Tone } from '../theme/tokens';
import { useTheme } from './theme';

// Toasts con autocierre a 3 s. `data-testid="toast-{ok|danger|info|warn}"`, igual que la web (los apilados se localizan con `filter`).

export type ToastKind = 'ok' | 'danger' | 'info' | 'warn';

/** Duración visible de un toast (regla de testabilidad del proyecto). */
export const TOAST_MS = 3000;

interface ToastItem {
  readonly id: number;
  readonly kind: ToastKind;
  readonly title: string;
  readonly body?: string;
}

interface ToastValue {
  readonly push: (kind: ToastKind, title: string, body?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const KIND_TONE: Readonly<Record<ToastKind, Tone>> = { ok: 'ok', danger: 'danger', info: 'info', warn: 'warn' };

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current, { id, kind, title, body }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), TOAST_MS);
  }, []);

  const value = useMemo<ToastValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.host}>
        {items.map((item) => {
          const tone = toneColors(colors, KIND_TONE[item.kind]);
          return (
            <View
              key={item.id}
              testID={ACCESO_DYNAMIC_TESTIDS.TOAST(item.kind)}
              role={item.kind === 'danger' ? 'alert' : 'status'}
              aria-live={item.kind === 'danger' ? 'assertive' : 'polite'}
              style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: tone.fg }]}
            >
              <Text variant="label">{item.title}</Text>
              {item.body ? <Text variant="small" tone="muted">{item.body}</Text> : null}
            </View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastValue => {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider');
  return value;
};

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 12, left: 12, right: 12, gap: 8, zIndex: 100 },
  toast: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RADIUS.sm, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
