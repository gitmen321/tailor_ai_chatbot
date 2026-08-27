import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  checkServerHealth,
  fetchChatHistory,
  fileToBase64,
  getOrCreateWebUserId,
  isChatUiCleared,
  sendChatMessage,
  setChatUiCleared,
  transcribeAudio,
} from "../api.js";
import Icon, { BrandMark } from "../components/Icon.jsx";
import { useVoiceSettings } from "../contexts/VoiceSettingsContext.jsx";
import { useWallpaper } from "../contexts/WallpaperContext.jsx";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";

const WELCOME_ML =
  "നമസ്കാരം റസിയ! യൂഷ ക്വിക്ക് സ്റ്റിച്ച് മെഷീനെ കുറിച്ച് ചോദിക്കാം. ടൈപ്പ് ചെയ്യുക, ശബ്ദസന്ദേശം അയയ്ക്കുക, അല്ലെങ്കിൽ ഫോട്ടോ എടുക്കുക.";

const TRANSCRIBE_FAIL_ML =
  "ശബ്ദം മനസ്സിലാക്കാൻ കഴിഞ്ഞില്ല. വ്യക്തമായി സംസാരിച്ച് വീണ്ടും ശ്രമിക്കുക.";

const RECORDING_TOO_SHORT_ML =
  "വളരെ ചെറുതാണ്. ഒരു സെക്കൻഡ് എങ്കിലും സംസാരിച്ച ശേഷം നിർത്തുക.";

const STOPPED_ML = "നിർത്തി. വീണ്ടും ശ്രമിക്കാം.";

function welcomeMessage() {
  return { id: "welcome", role: "assistant", content: WELCOME_ML };
}

function mapHistoryRow(row) {
  const videos = Array.isArray(row.metadata?.videos) ? row.metadata.videos : [];
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    hasImage: row.media_type === "image",
    videos,
  };
}

export default function ChatScreen() {
  const { wallpaperClass, wallpaperStyle } = useWallpaper();
  const {
    readAloud,
    setReadAloud,
    ttsSupported,
    isSpeaking,
    isLoadingSpeech,
    speechError,
    clearSpeechError,
    unlockAudio,
    speakReply,
    speakText,
    stopSpeaking,
  } = useVoiceSettings();
  const [webUserId] = useState(() => getOrCreateWebUserId());
  const [messages, setMessages] = useState([welcomeMessage()]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [transcribeError, setTranscribeError] = useState(null);
  const [serverOk, setServerOk] = useState(null);
  const [lastAudio, setLastAudio] = useState(null);

  const listRef = useRef(null);
  const fileRef = useRef(null);
  const chatAbortRef = useRef(null);
  const transcribeAbortRef = useRef(null);

  const {
    isRecording,
    elapsedLabel,
    inputMode,
    error: recorderError,
    clearError: clearRecorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder({
    onInterimTranscript: (interim) => {
      if (interim) setText(interim);
    },
  });

  const scrollToLatest = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [messages, loading, transcribing, isRecording, scrollToLatest]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await checkServerHealth();
        if (!cancelled) {
          setServerOk(true);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setServerOk(false);
          setError(
            "സെർവറിലേക്ക് കണക്ട് ചെയ്യാൻ കഴിഞ്ഞില്ല. ഇന്റർനെറ്റ് / സെർവർ ഓൺലൈൻ ആണോ എന്ന് പരിശോധിക്കുക."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (recorderError) setError(recorderError);
  }, [recorderError]);

  useEffect(() => {
    if (historyLoaded || isChatUiCleared()) {
      setHistoryLoaded(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const data = await fetchChatHistory({
          webUserId,
          signal: controller.signal,
        });
        if (cancelled) return;

        const rows = (data.messages ?? []).map(mapHistoryRow);
        if (rows.length > 0) {
          setMessages(rows);
        }
      } catch {
        /* keep welcome message if history unavailable */
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [webUserId, historyLoaded]);

  function handleForceStop() {
    chatAbortRef.current?.abort();
    transcribeAbortRef.current?.abort();
    chatAbortRef.current = null;
    transcribeAbortRef.current = null;

    if (isRecording) cancelRecording();

    setLoading(false);
    setTranscribing(false);
    setError(STOPPED_ML);
  }

  function handleClearChat() {
    setChatUiCleared(true);
    setMessages([welcomeMessage()]);
    setError(null);
    setTranscribeError(null);
    setText("");
    clearPendingImage();
  }

  function handleRestoreHistory() {
    setChatUiCleared(false);
    setHistoryLoaded(false);
  }

  async function onPickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setPendingImage({
        base64,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        mimeType: file.type || "image/jpeg",
      });
      setError(null);
    } catch {
      setError("ഫോട്ടോ വായിക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.");
    }
  }

  function clearPendingImage() {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  }

  async function runTranscription(audioPayload) {
    // Browser speech API already produced text — skip server round-trip.
    if (audioPayload.transcript) {
      setText(audioPayload.transcript);
      setTranscribeError(null);
      setError(null);
      return;
    }

    transcribeAbortRef.current?.abort();
    const controller = new AbortController();
    transcribeAbortRef.current = controller;

    setTranscribing(true);
    setTranscribeError(null);
    setError(null);
    setLastAudio(audioPayload);

    try {
      const data = await transcribeAudio({
        audioBase64: audioPayload.base64,
        mimeType: audioPayload.mimeType,
        signal: controller.signal,
      });
      setText(data.transcript);
      setTranscribeError(null);
      setServerOk(true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setTranscribeError(TRANSCRIBE_FAIL_ML);
    } finally {
      setTranscribing(false);
      transcribeAbortRef.current = null;
    }
  }

  async function handleMicToggle() {
    if (loading || transcribing) {
      handleForceStop();
      return;
    }

    clearRecorderError();

    if (isRecording) {
      const audioPayload = await stopRecording();
      if (!audioPayload) return;
      if (audioPayload.error === "too_short" || audioPayload.error === "too_small") {
        setTranscribeError(RECORDING_TOO_SHORT_ML);
        return;
      }
      await runTranscription(audioPayload);
      return;
    }

    setTranscribeError(null);
    await startRecording();
  }

  async function retryTranscription() {
    if (!lastAudio || transcribing) return;
    await runTranscription(lastAudio);
  }

  function handleCancelRecording() {
    cancelRecording();
    setTranscribeError(null);
  }

  async function handleSend(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || loading || transcribing || isRecording) return;

    setChatUiCleared(false);

    const outboundText = trimmed || "(image)";
    const imageBase64 = pendingImage?.base64 ?? null;
    const imageMimeType = pendingImage?.mimeType ?? null;
    const previewUrl = pendingImage?.previewUrl ?? null;

    setText("");
    setPendingImage(null);
    setError(null);
    setTranscribeError(null);
    setLastAudio(null);
    setLoading(true);

    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: outboundText,
      imagePreview: previewUrl,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await sendChatMessage({
        webUserId,
        text: outboundText,
        imageBase64,
        imageMimeType,
        signal: controller.signal,
      });
      setServerOk(true);
      const reply = data.reply || "(no reply)";
      const videos = data.videos ?? [];
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply, videos },
      ]);
      speakReply(reply);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setServerOk(false);
      const msg = String(err?.message || "");
      setError(
        err?.name === "AbortError" || msg.includes("aborted")
          ? STOPPED_ML
          : msg.includes("Failed to fetch") || err?.name === "TypeError"
            ? "സെർവർ ലഭ്യമല്ല. സെർവർ ഓൺലൈൻ ആണോ എന്ന് പരിശോധിക്കുക."
            : msg.length > 120
              ? `പിശക്: ${msg.slice(0, 120)}…`
              : `പിശക്: ${msg || "അജ്ഞാത പിശക്"}`
      );
    } finally {
      setLoading(false);
      chatAbortRef.current = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  }

  const hasText = Boolean(text.trim());
  const showSend = hasText || pendingImage;
  const isBusy = loading || transcribing;
  const composerDisabled = isBusy || isRecording;

  return (
    <div className="app-shell chat-shell screen-enter">
      <header className="app-header">
        <div className="brand-lockup">
          <BrandMark size={40} />
          <div className="brand-block">
            <h1>Tailor Assistant</h1>
            <p>റസിയയ്ക്കുള്ള സഹായി · യൂഷ ക്വിക്ക് സ്റ്റിച്ച്</p>
          </div>
        </div>
        <div className="header-actions">
          <div
            className={`status-pill ${
              serverOk === true ? "ok" : serverOk === false ? "bad" : "pending"
            }`}
            title={
              serverOk === true
                ? "Server online"
                : serverOk === false
                  ? "Server offline"
                  : "Checking server…"
            }
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="status-text">
              {serverOk === true
                ? "Online"
                : serverOk === false
                  ? "Offline"
                  : "…"}
            </span>
          </div>
          <button
            type="button"
            className={`icon-btn ${readAloud ? "is-active" : ""}`}
            onClick={() => {
              unlockAudio();
              clearSpeechError();
              if (isSpeaking || isLoadingSpeech) {
                stopSpeaking();
                return;
              }
              setReadAloud(!readAloud);
            }}
            aria-label={
              isSpeaking
                ? "Stop reading aloud"
                : readAloud
                  ? "Turn off read aloud"
                  : "Turn on read aloud"
            }
            title={
              readAloud
                ? "മറുപടി ഉറക്കെ വായിക്കുക: ഓൺ"
                : "മറുപടി ഉറക്കെ വായിക്കുക: ഓഫ്"
            }
            disabled={!ttsSupported}
          >
            {isSpeaking ? (
              <Icon name="stop" size={16} />
            ) : isLoadingSpeech ? (
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <Icon name={readAloud ? "volume-on" : "volume-off"} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn is-danger"
            onClick={handleClearChat}
            aria-label="Clear chat on screen"
            title="Clear chat (saved in database)"
          >
            <Icon name="trash" />
          </button>
          <Link to="/profile" className="icon-btn" aria-label="Profile">
            <Icon name="user" />
          </Link>
          <Link to="/settings" className="icon-btn" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <Icon name="shield" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {speechError ? (
        <div className="error-banner" role="alert">
          <Icon name="volume-off" size={16} />
          <span>{speechError}</span>
        </div>
      ) : null}

      {isChatUiCleared() ? (
        <div className="chat-ui-notice">
          <span>ചാറ്റ് UI-യിൽ മാത്രം മായ്ച്ചു — ഡാറ്റാബേസിൽ സൂക്ഷിച്ചിരിക്കുന്നു.</span>
          <button type="button" onClick={handleRestoreHistory}>
            ചരിത്രം കാണുക
          </button>
        </div>
      ) : null}

      <main
        className={`chat-panel ${wallpaperClass}`}
        style={wallpaperStyle}
        ref={listRef}
      >
        <ul className="message-list">
          {messages.map((m) => (
            <li key={m.id} className={`bubble-row ${m.role}`}>
              {m.role === "assistant" ? (
                <BrandMark size={26} className="msg-avatar" />
              ) : null}
              <div className={`bubble ${m.role}`}>
                {m.imagePreview ? (
                  <img className="bubble-image" src={m.imagePreview} alt="Uploaded" />
                ) : m.hasImage ? (
                  <p className="bubble-media-tag">
                    <Icon name="image" size={13} />
                    ഫോട്ടോ
                  </p>
                ) : null}
                <p>{m.content}</p>
                {m.videos?.length ? (
                  <div className="video-links">
                    <p className="video-links-title">
                      <Icon name="play" size={13} />
                      യൂട്യൂബ് വീഡിയോകൾ
                    </p>
                    {m.videos.map((v, i) => (
                      <a
                        key={`${m.id}-v-${i}`}
                        className="video-link-card"
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="video-link-thumb" aria-hidden="true">
                          <Icon name="play" size={19} />
                        </span>
                        <span className="video-link-body">
                          <span className="video-link-title">{v.title}</span>
                          {v.snippet ? (
                            <span className="video-link-snippet">{v.snippet}</span>
                          ) : null}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {m.role === "assistant" && ttsSupported ? (
                  <button
                    type="button"
                    className={`bubble-speak-btn ${
                      isSpeaking || isLoadingSpeech ? "is-playing" : ""
                    }`}
                    onClick={() => {
                      unlockAudio();
                      clearSpeechError();
                      if (isSpeaking || isLoadingSpeech) stopSpeaking();
                      else void speakText(m.content);
                    }}
                    aria-label="Read this reply aloud"
                  >
                    {isLoadingSpeech ? (
                      <>
                        <span className="transcribing-spinner" aria-hidden="true" />
                        ലോഡ് ചെയ്യുന്നു
                      </>
                    ) : isSpeaking ? (
                      <>
                        <Icon name="stop" size={13} />
                        നിർത്തുക
                      </>
                    ) : (
                      <>
                        <Icon name="volume-on" size={14} />
                        കേൾക്കുക
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {loading ? (
            <li className="bubble-row assistant">
              <BrandMark size={26} className="msg-avatar" />
              <div className="bubble assistant loading" aria-live="polite">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </li>
          ) : null}
        </ul>
      </main>

      <form className="composer" onSubmit={handleSend}>
        {pendingImage ? (
          <div className="pending-image">
            <img src={pendingImage.previewUrl} alt="Selected" />
            <button
              type="button"
              className="clear-image"
              onClick={clearPendingImage}
              aria-label="Remove photo"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : null}

        {isRecording ? (
          <div className="recording-bar" role="status" aria-live="polite">
            <span className="recording-pulse" aria-hidden="true" />
            <div className="recording-meta">
              <span className="recording-label">
                {inputMode === "speech-api"
                  ? "കേൾക്കുന്നു… സംസാരിക്കുക"
                  : "റിക്കോർഡ് ചെയ്യുന്നു…"}
              </span>
              <span className="recording-timer">{elapsedLabel}</span>
            </div>
            <div className="recording-wave" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <button
              type="button"
              className="recording-cancel"
              onClick={handleCancelRecording}
              aria-label="Cancel recording"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ) : null}

        {transcribing ? (
          <div className="transcribing-bar" role="status" aria-live="polite">
            <span className="transcribing-spinner" aria-hidden="true" />
            <span>ശബ്ദം എഴുത്താക്കുന്നു…</span>
          </div>
        ) : null}

        {transcribeError ? (
          <div className="transcribe-error" role="alert">
            <p>{transcribeError}</p>
            <button
              type="button"
              className="transcribe-retry-btn"
              onClick={retryTranscription}
              disabled={!lastAudio || transcribing}
            >
              <Icon name="refresh" size={14} />
              വീണ്ടും ശ്രമിക്കുക
            </button>
          </div>
        ) : null}

        <div className="composer-row">
          <div className="composer-field">
            <button
              type="button"
              className="attach-btn"
              onClick={() => fileRef.current?.click()}
              aria-label="Take or upload photo"
              disabled={composerDisabled}
            >
              <Icon name="camera" size={19} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPickImage}
            />
            <input
              className="text-input"
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder={
                transcribing
                  ? "ശബ്ദം എഴുത്താക്കുന്നു…"
                  : loading
                    ? "ഉത്തരം വരുന്നു…"
                    : "ചോദ്യം ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക്…"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={composerDisabled}
            />
          </div>

          {isBusy ? (
            <button
              type="button"
              className="mic-btn is-force-stop"
              onClick={handleForceStop}
              aria-label="Stop and cancel"
            >
              <Icon name="stop" size={16} />
            </button>
          ) : showSend ? (
            <button
              type="submit"
              className="send-btn"
              disabled={isRecording}
              aria-label="Send message"
            >
              <span className="send-label-long">അയയ്ക്കുക</span>
              <span className="send-label-short">
                <Icon name="send" size={19} />
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={`mic-btn ${isRecording ? "is-recording" : ""}`}
              onClick={handleMicToggle}
              aria-label={isRecording ? "Stop recording" : "Record voice message"}
            >
              <Icon name={isRecording ? "stop" : "mic"} size={isRecording ? 16 : 20} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
