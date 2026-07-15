import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MessageThread } from "./components/MessageThread";
import { QuickReplies } from "./components/QuickReplies";
import { Composer } from "./components/Composer";
import { useChat } from "./hooks/useChat";
import "./App.css";

export default function App() {
  const chat = useChat();
  const isEmpty = chat.messages.length === 0;

  return (
    <div className="app">
      <div className="starfield" aria-hidden="true" />
      <Header
        onNewChat={chat.newChat}
        disabled={isEmpty}
        mode={chat.mode}
        onModeChange={chat.setMode}
        llmAvailable={chat.llmAvailable}
      />

      <main className="chat-viewport">
        {isEmpty ? (
          <WelcomeScreen onSelect={chat.send} />
        ) : (
          <MessageThread
            messages={chat.messages}
            isWaiting={chat.isWaiting}
            streamingId={chat.streamingId}
            error={chat.error}
            onRetry={chat.retry}
            onDismissError={chat.dismissError}
          />
        )}
      </main>

      {!isEmpty && (
        <QuickReplies isLiveAgent={chat.isLiveAgent} disabled={chat.isBusy} onSelect={chat.send} />
      )}

      <Composer
        input={chat.input}
        onInputChange={chat.setInput}
        isBusy={chat.isBusy}
        onSubmit={chat.send}
        onStop={chat.stop}
      />
    </div>
  );
}
