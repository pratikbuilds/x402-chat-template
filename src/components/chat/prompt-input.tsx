import { SymbolImage } from "@/components/symbol-image";
import { TouchableGlass } from "@/components/touchable-glass";
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { cn } from "@/utils/tailwind";
import { useChatContext } from "./chat-context";
import { useConversationContext } from "./conversation";
import { WalletBalanceChip } from "@/wallet/wallet-balance-chip";

const AnimatedGlassContainer = Animated.createAnimatedComponent(GlassContainer);
const ComposerContainer = process.env.EXPO_OS === "android" ? View : AnimatedGlassContainer;

/**
 * Root container for the message composer. Positions itself at the bottom of
 * the `<Conversation />` using the shared conversation context. Children are
 * laid out in a horizontal row inside a glass container.
 */
export function PromptInput({ children }: { children: ReactNode }) {
  const { promptInputStyle, onPromptInputLayout } = useConversationContext();
  const { error } = useChatContext();

  return (
    <Animated.View
      onLayout={onPromptInputLayout}
      style={process.env.EXPO_OS === "android" ? undefined : [{ position: "absolute", left: 0, right: 0 }, promptInputStyle]}
      className="bg-background"
    >
      {error && <PromptInputError message={error.message} />}
      <WalletBalanceChip />
      <ComposerContainer
        style={{
          flexDirection: "row",
          padding: 12,
          gap: 10,
          alignItems: "flex-end",
        }}
        spacing={8}
      >
        {children}
      </ComposerContainer>
    </Animated.View>
  );
}

function PromptInputError({ message }: { message?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-3 pb-2">
      <View
        className="flex-row items-center gap-2 rounded-xl bg-card px-3 py-2.5 border-continuous"
      >
        <View
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: "#EF4444" }}
        />
        <Text
          className="flex-1 text-xs text-muted-foreground"
          numberOfLines={2}
        >
          {message || "Something went wrong"}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * A circular glass button for actions (e.g. attachments, camera).
 */
export function PromptInputAction(props: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableGlass
      hitSlop={4}
      {...props}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
      }}
    />
  );
}

/**
 * Glass-wrapped container for the textarea and submit button.
 */
export function PromptInputBody({ children }: { children: ReactNode }) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle="regular"
        className="border-continuous"
        style={{
          flex: 1,
          flexDirection: "row",

          borderRadius: 22,
        }}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      className="border-continuous bg-muted"
      style={{
        flex: 1,
        flexDirection: "row",

        overflow: "hidden",
        borderRadius: 22,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Auto-growing text input for composing messages. Reads/writes the current
 * input value from `ChatContext`.
 */
export function PromptInputTextarea({
  placeholder = "Chat with Agent...",
  maxLength = 1000,
}: {
  placeholder?: string;
  maxLength?: number;
}) {
  const { input, setInput } = useChatContext();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (input === "") {
      inputRef.current?.clear();
    }
  }, [input]);

  return (
    <TextInput
      ref={inputRef}
      nativeID="composer"
      cursorColorClassName="accent-foreground"
      selectionColorClassName="accent-foreground"
      style={{ fontSize: 16 }}
      className="flex-1 pl-4 pr-2 py-3 text-foreground max-h-25"
      value={input}
      onChangeText={setInput}
      placeholder={placeholder}
      multiline
      maxLength={maxLength}
    />
  );
}

/**
 * Submit button that sends the current input. Shows a spinner while the model
 * is generating. Reads state from `ChatContext`.
 */
export function PromptInputSubmit() {
  const { canSend, input, isGenerating, onSend } = useChatContext();
  const disabled = !input.trim() || !canSend;
  const showSpinner = isGenerating && !canSend;

  return (
    <Pressable
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
        margin: 5,
      }}
      className={cn(
        disabled ? "bg-secondary" : "bg-foreground",
        "active:opacity-70",
      )}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      onPress={onSend}
      disabled={disabled}
    >
      {showSpinner ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <ActivityIndicator size="small" colorClassName="accent-foreground" className="text-foreground" />
        </Animated.View>
      ) : (
          <SymbolImage
            name="arrow.up"
            size={16}
            tintColor={disabled ? "#888888" : "#ffffff"}
            sfEffect="scale/up"
            className={cn(
              "font-semibold",
              disabled
                ? "text-muted-foreground"
                : "text-background",
            )}
          />
      )}
    </Pressable>
  );
}
