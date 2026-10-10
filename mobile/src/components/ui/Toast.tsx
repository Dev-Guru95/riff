// Lightweight toast for success/error feedback after mutations. One at a time,
// announced to screen readers.
//
// Toasts must stay visible while a React Native <Modal> sheet is open:
//  - iOS: the root toast renders in a FullWindowOverlay (react-native-screens),
//    a separate native window above every modal. Nothing to adopt.
//  - Android: a Modal is its own Dialog window, so nothing in the activity
//    window can draw over it. A <ToastHost /> mounted inside the Modal takes
//    over while it is open. Use the kit's drop-in <Modal> (exported from
//    "@/components/ui"), which mounts the host for you, or render <ToastHost />
//    as the last child of a custom Modal.
//
// The API is unchanged: `const toast = useToast(); toast("Saved")`.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal as RNModal, Platform, StyleSheet, type ModalProps } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, tint } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";

type Tone = "success" | "error" | "info";
type ToastFn = (message: string, tone?: Tone) => void;
type ToastState = { message: string; tone: Tone; id: number };

type HostRegistry = {
  toast: ToastState | null;
  opacity: Animated.Value;
  /** Topmost mounted in-modal host (Android), or null for the root. */
  activeHost: number | null;
  register: (id: number) => () => void;
};

const ToastContext = createContext<ToastFn>(() => {});
const HostContext = createContext<HostRegistry | null>(null);

let seq = 0;
const IN_MODAL_HOSTS = Platform.OS === "android";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [hosts, setHosts] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>((message, tone = "success") => {
    seq += 1;
    setToast({ message, tone, id: seq });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        // A newer toast may have arrived during the fade-out: only clear this one.
        setToast((cur) => (cur?.id === id ? null : cur)),
      );
    }, toast.tone === "error" ? 4000 : 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, opacity]);

  const register = useCallback((id: number) => {
    setHosts((h) => [...h, id]);
    return () => setHosts((h) => h.filter((x) => x !== id));
  }, []);

  const activeHost = hosts.length ? hosts[hosts.length - 1]! : null;
  const registry = useMemo<HostRegistry>(() => ({ toast, opacity, activeHost, register }), [toast, opacity, activeHost, register]);

  let rootToast: React.ReactNode = null;
  if (toast && activeHost === null) {
    const view = <ToastView toast={toast} opacity={opacity} placement="bottom" />;
    rootToast = Platform.OS === "ios" ? <FullWindowOverlay>{view}</FullWindowOverlay> : view;
  }

  return (
    <ToastContext.Provider value={show}>
      <HostContext.Provider value={registry}>
        {children}
        {rootToast}
      </HostContext.Provider>
    </ToastContext.Provider>
  );
}

let hostSeq = 0;

/**
 * Renders the app's toast inside a native Modal (Android). Mount it as the last
 * child of a Modal; it is a no-op on iOS, where the root toast already sits above
 * modals.
 */
export function ToastHost() {
  const ctx = useContext(HostContext);
  const [id] = useState(() => ++hostSeq);
  const register = ctx?.register;
  useEffect(() => {
    if (!IN_MODAL_HOSTS || !register) return;
    return register(id);
  }, [register, id]);
  if (!IN_MODAL_HOSTS || !ctx?.toast || ctx.activeHost !== id) return null;
  return <ToastView toast={ctx.toast} opacity={ctx.opacity} placement="top" />;
}

/** Drop-in replacement for React Native's Modal that keeps toasts visible above it. */
export function Modal({ children, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      {children}
      <ToastHost />
    </RNModal>
  );
}

function ToastView({ toast, opacity, placement }: { toast: ToastState; opacity: Animated.Value; placement: "top" | "bottom" }) {
  const insets = useSafeAreaInsets();
  const color = toast.tone === "error" ? colors.danger : toast.tone === "info" ? colors.accent : colors.success;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        placement === "bottom" ? { bottom: insets.bottom + 72 } : { top: insets.top + 12 },
        { opacity, borderColor: tint(color) },
      ]}
    >
      <Icon name={toast.tone === "error" ? "close" : "check"} size={16} color={color} />
      <Text style={{ flex: 1 }}>{toast.message}</Text>
    </Animated.View>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
  },
});
