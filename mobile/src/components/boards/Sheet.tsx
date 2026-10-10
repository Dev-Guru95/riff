// Native modal surfaces for the Kanban screens:
//  - <Sheet>          a page sheet (iOS) / full-screen modal (Android) with a
//                     title bar, used for the web's side drawers (members,
//                     labels, activity, archive, settings).
//  - useActionSheet() a bottom action sheet, the touch stand-in for the web's
//                     dropdown menus and <select>s.
//  - usePrompt()      a one-field text dialog (Alert.prompt is iOS-only), the
//                     stand-in for the web's click-to-rename inputs.

import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, Icon, Modal, Text, type IconName } from "@/components/ui";
import { colors, radius, TOUCH } from "@/theme/tokens";

export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** false when the content is its own list (FlashList). */
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "ios" ? 0 : insets.top;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: top }]}>
        <View style={styles.bar}>
          <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
            <Icon name="close" size={20} />
          </Pressable>
        </View>
        {scroll ? (
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <View style={{ flex: 1, paddingBottom: insets.bottom }}>{children}</View>
        )}
      </View>
    </Modal>
  );
}

export type SheetOption = {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};
type SheetState = { title?: string; message?: string; options: SheetOption[] };

/**
 * `const sheet = useActionSheet()` → render `{sheet.element}` and call
 * `sheet.show({ title, options })`. The chosen action runs after the sheet has
 * closed, so it may open another modal or Alert safely.
 */
export function useActionSheet() {
  const [state, setState] = useState<SheetState | null>(null);
  const show = useCallback((s: SheetState) => setState(s), []);
  const close = useCallback(() => setState(null), []);
  const element = <ActionSheetModal state={state} onClose={close} />;
  return { show, close, element };
}

function ActionSheetModal({ state, onClose }: { state: SheetState | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const choose = (o: SheetOption) => {
    onClose();
    // iOS can't present a new modal until this one has finished dismissing.
    setTimeout(o.onPress, Platform.OS === "ios" ? 400 : 50);
  };
  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
      <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
        {state?.title || state?.message ? (
          <View style={styles.panelHead}>
            {state.title ? <Text weight="semibold" numberOfLines={2}>{state.title}</Text> : null}
            {state.message ? <Text variant="caption">{state.message}</Text> : null}
          </View>
        ) : null}
        <ScrollView style={{ maxHeight: 440 }} bounces={false}>
          {state?.options.map((o, i) => (
            <Pressable
              key={`${o.label}-${i}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!o.disabled, selected: !!o.selected }}
              disabled={o.disabled}
              onPress={() => choose(o)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface2 }, o.disabled && { opacity: 0.4 }]}
            >
              {o.icon ? <Icon name={o.icon} size={18} color={o.destructive ? colors.danger : colors.muted} /> : null}
              <Text style={{ flex: 1 }} weight="medium" color={o.destructive ? colors.danger : undefined} numberOfLines={1}>
                {o.label}
              </Text>
              {o.selected ? <Icon name="check" size={18} color={colors.brand} /> : null}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.option, styles.cancel, pressed && { backgroundColor: colors.surface2 }]}>
          <Text weight="semibold" style={{ flex: 1, textAlign: "center" }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

type PromptState = {
  title: string;
  message?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  multiline?: boolean;
  onSubmit: (text: string) => void;
};

/** `const prompt = usePrompt()` → render `{prompt.element}`, call `prompt.show({...})`. */
export function usePrompt() {
  const [state, setState] = useState<PromptState | null>(null);
  const show = useCallback((s: PromptState) => setState(s), []);
  const close = useCallback(() => setState(null), []);
  const element = state ? <PromptModal key={state.title + (state.initial ?? "")} state={state} onClose={close} /> : null;
  return { show, close, element };
}

function PromptModal({ state, onClose }: { state: PromptState; onClose: () => void }) {
  const [text, setText] = useState(state.initial ?? "");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onClose();
    state.onSubmit(t);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.dialogWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="heading" accessibilityRole="header">{state.title}</Text>
          {state.message ? <Text variant="small">{state.message}</Text> : null}
          <Field
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder={state.placeholder}
            maxLength={state.maxLength}
            multiline={state.multiline}
            returnKeyType="done"
            submitBehavior={state.multiline ? undefined : "submit"}
            onSubmitEditing={state.multiline ? undefined : submit}
            accessibilityLabel={state.title}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Button title="Cancel" variant="ghost" size="sm" onPress={onClose} />
            <Button title={state.confirmLabel ?? "Save"} size="sm" onPress={submit} disabled={!text.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dialogWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  sheet: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  close: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center", marginRight: -10 },
  content: { padding: 16, gap: 16 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  panelHead: { paddingHorizontal: 16, paddingVertical: 10, gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 52 },
  cancel: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
});
