/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { html, LitElement } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
// tslint:disable-next-line:ban-malformed-import-paths
import hljs from 'highlight.js'
import { classMap } from 'lit/directives/class-map.js'
import { map } from 'lit/directives/map.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'

/** Markdown formatting function with syntax hilighting */
export const marked = new Marked(
  markedHighlight({
    async: true,
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight (code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

const ICON_BUSY = html`<svg
  class="rotating"
  xmlns="http://www.w3.org/2000/svg"
  height="24px"
  viewBox="0 -960 960 960"
  width="24px"
  fill="currentColor"
>
  <path
    d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Z"
  />
</svg>`
const ICON_EDIT = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  height="16px"
  viewBox="0 -960 960 960"
  width="16px"
  fill="currentColor"
>
  <path
    d="M120-120v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm584-528 56-56-56-56-56 56 56 56Z"
  />
</svg>`
const ICON_LOAD = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  height="16px"
  viewBox="0 -960 960 960"
  width="16px"
  fill="currentColor"
>
  <path
    d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Z"
  />
</svg>`
const ICON_SNAPSHOT = html`<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h400q17 0 28.5-11.5T720-320v-320q0-17-11.5-28.5T680-680H280q-17 0-28.5 11.5T240-640v320q0 17 11.5 28.5T280-280Zm80-360h240q17 0 28.5-11.5T640-680v-80q0-17-11.5-28.5T600-800H360q-17 0-28.5 11.5T320-760v80q0 17 11.5 28.5T360-640ZM200-200v-560 560Z"/></svg>`;
const ICON_DOWNLOAD = html`<svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>`;

const p5jsCdnUrl =
  'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js'
const p5soundCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/addons/p5.sound.min.js'

/**
 * Chat state enum to manage the current state of the chat interface.
 */
export enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  CODING
}

/**
 * Chat tab enum to manage the current selected tab in the chat interface.
 */
enum ChatTab {
  GEMINI,
  CODE
}

/**
 * Chat role enum to manage the current role of the message.
 */
export enum ChatRole {
  USER,
  ASSISTANT,
  SYSTEM
}

/** Interface for a message object */
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system-ask' | 'error' | 'manual-snapshot'
  text: string // Rendered HTML content
  thinkingText?: string // Rendered HTML thinking content (optional)
  code?: string // Raw p5.js code string (optional)
  isThinkingOpen?: boolean // State for the thinking details
}

/**
 * Playground component for p5js.
 */
@customElement('gdm-playground')
export class Playground extends LitElement {
  @query('#anchor') anchor
  @query('#reloadTooltip') reloadTooltip
  private readonly codeSyntax = document.createElement('div')

  @state() chatState = ChatState.IDLE
  @state() isRunning = true
  @state() selectedChatTab = ChatTab.GEMINI
  @state() inputMessage = ''
  @state() code = ''
  @state() messages: Message[] = []
  @state() codeHasChanged = true
  @state() codeNeedsReload = false
  @state() activeCodeVersionId: string | null = null // Track which version is loaded

  private defaultCode = ''
  private readonly previewFrame: HTMLIFrameElement =
    document.createElement('iframe')
  private lastError = ''
  private reportedError = false

  sendMessageHandler?: CallableFunction
  resetHandler?: CallableFunction

  constructor () {
    super()
    this.previewFrame.classList.add('preview-iframe')
    this.previewFrame.setAttribute('allowTransparency', 'true')

    this.codeSyntax.classList.add('code-syntax')

    /* Receive message from the iframe in case any error occures. */
    window.addEventListener(
      'message',
      msg => {
        if (msg.data && typeof msg.data === 'string') {
          try {
            const message = JSON.parse(msg.data).message
            this.runtimeErrorHandler(message)
          } catch (e) {
            console.error(e)
          }
        }
      },
      false
    )
  }

  /** Disable shadow DOM */
  createRenderRoot () {
    return this
  }

  setDefaultCode (code: string) {
    this.defaultCode = code
  }

  async setCode(code: string, sourceMessageId: string | null = null) {
    this.code = code;
    this.runCode(code);

    this.codeSyntax.innerHTML = await marked.parse(
      '```javascript\n' + code + '\n```',
    );
    // When code is set (either initially, by AI, or by loading a version),
    // it's no longer "changed" relative to the preview.
    this.codeHasChanged = false;
    this.activeCodeVersionId = sourceMessageId; // Track the loaded version
    this.requestUpdate(); // Ensure UI reflects the change
  }

  setChatState (state: ChatState) {
    this.chatState = state
  }

  runCode (code: string) {
    this.reportedError = false
    this.lastError = ''

    const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>p5.js Sketch</title>
                    <style>
                        body { margin: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8f9fa; }
                        main { display: flex; justify-content: center; align-items: center; }
                        .console { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0, 0, 0, 0.7); padding: 1em; margin: 0; color: red; font-family: monospace;}
                    </style>
                    <script src="${p5jsCdnUrl}"></script>
                    <script src="${p5soundCdnUrl}"></script>
                    <script>
                      window.theSketchInstance = null;
                      window.addEventListener('message', (event) => {
                        console.log('Message received from parent:', event.data);
                        const instance = window.theSketchInstance;

                        if (!instance) {
                          console.warn('Sketch instance (window.theSketchInstance) not found yet.');
                          // Attempt to grab it again, maybe it wasn't ready before?
                          window.theSketchInstance = window.p5?.instance;
                          if (!window.theSketchInstance) {
                            console.warn('Still cannot find sketch instance.');
                            return;
                          }
                          // If found now, retry using the newly found instance
                          instance = window.theSketchInstance;
                      }

                      if (event.data === 'stop') {
                          if (typeof instance.noLoop === 'function') {
                              instance.noLoop();
                              console.log('Sketch stopped (theSketchInstance.noLoop)');
                          } else {
                              console.warn('theSketchInstance.noLoop is not available.');
                          }
                      } else if (event.data === 'resume') {
                          if (typeof instance.loop === 'function') {
                              instance.loop();
                              console.log('Sketch resumed (theSketchInstance.loop)');
                          } else {
                              console.warn('theSketchInstance.loop is not available.');
                          }
                      }
                  }, false);
                </script>
                </head>
                <body>
                    <script>
                        // Basic error handling within the iframe
                        try {
                            // 3. Override p5 constructor BEFORE user code runs
                            if (typeof window.p5 === 'function') {
                                originalP5Constructor = window.p5; // Store the original

                                window.p5 = function(...args) {
                                    console.log('Overridden p5 constructor called.');
                                    // Call the original constructor with the same arguments
                                    const instance = new originalP5Constructor(...args);
                                    // Capture the returned instance
                                    window.theSketchInstance = instance;
                                    console.log('p5 instance captured via constructor override:', window.theSketchInstance);
                                    // Return the instance so the sketch initializes correctly
                                    return instance;
                                };
                                // Copy static properties (like Vector, etc.) from original to wrapper
                                Object.assign(window.p5, originalP5Constructor);
                            } else {
                                console.error("window.p5 not found before sketch execution. Cannot override constructor.");
                            }

                            // 4. User's code is injected here. It will call our overridden constructor.
                            ${code}

                        } catch (error) {
                            console.error("Error in sketch:", error);
                            parent.postMessage(
                              JSON.stringify({
                                message: error.toString()
                              })
                            );
                            // Display error in the iframe itself
                            document.body.innerHTML = '<div style="padding: 20px; font-family: monospace; color: red; background: #fff0f0;">' +
                                                      '<h3>Sketch Error</h3><pre>' + error.toString() + '</pre>' +
                                                      '<p>Check the browser console for details or ask Gemini to fix it.</p>' +
                                                      '</div>';
                        } finally {
                            // 5. Restore original p5 constructor (optional, but good practice)
                            if (originalP5Constructor) {
                                window.p5 = originalP5Constructor;
                                console.log('Original p5 constructor restored.');
                            }
                        }
                    </script>
                </body>
                </html>
            `

    this.previewFrame.setAttribute('srcdoc', htmlContent)
    this.codeNeedsReload = false
  }

  runtimeErrorHandler (errorMessage: string) {
    this.reportedError = true

    if (this.lastError !== errorMessage) {
      // Use the new addMessage structure
      this.addMessage({
        role: 'system-ask',
        text: errorMessage, // Store raw error message
        id: this.generateId()
      })
    }
    this.lastError = errorMessage
  }

  setInputField (message: string) {
    this.inputMessage = message.trim()
  }

  addMessage (
    messageData: Partial<Message> & { role: Message['role']; text: string }
  ): string {
    const id = messageData.id || this.generateId()
    const newMessage: Message = {
      isThinkingOpen: true, // Default thinking to open initially
      ...messageData,
      id // Ensure ID is set
    }

    this.messages = [...this.messages, newMessage] // Use spread to trigger update
    this.requestUpdate()
    this.scrollToTheEnd()
    return id // Return the ID so the caller can update this message later
  }

  // --- Helper to update specific message properties ---
  updateMessage (id: string, updates: Partial<Message>) {
    this.messages = this.messages.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
    // No need to call requestUpdate explicitly here, state change handles it
    this.scrollToTheEnd()
  }

  // --- Helper to generate unique IDs ---
  private generateId (): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  scrollToTheEnd () {
    // Use requestAnimationFrame to ensure scrolling happens after DOM update
    requestAnimationFrame(() => {
      if (!this.anchor) return
      this.anchor.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      })
    })
  }

  async sendMessageAction (message?: string, role?: string) {
    if (this.chatState !== ChatState.IDLE) return

    let manualSnapshotId: string | null = null;
    console.log(this.codeHasChanged, role?.toLowerCase());
    if (this.codeHasChanged && role?.toLowerCase() !== 'system') { // Don't snapshot before system prompts
        console.log("Code has changed, creating manual snapshot...");
        manualSnapshotId = this.addMessage({
            role: 'manual-snapshot',
            text: 'Snapshot of manual code edits.',
            code: this.code, // Store the current code
            id: this.generateId()
        });
        // Mark code as "not changed" relative to this new snapshot
        this.codeHasChanged = false;
        this.activeCodeVersionId = manualSnapshotId;
        // No need to call setCode here, just update the state flags
        this.requestUpdate(); // Ensure UI reflects the new snapshot and active state
    }

    this.chatState = ChatState.GENERATING

    let msg = ''
    if (message) {
      msg = message.trim()
    } else {
      // get message and empty the field
      msg = this.inputMessage.trim()
      this.inputMessage = ''
    }

    const msgRole = role ? role.toLowerCase() : 'user'

    // Only add user message if it's not empty
    // System messages are handled differently (e.g., runtime errors add their own message)
    // or passed directly to the handler below.
    if (msgRole === 'user' && msg.length > 0) {
        this.addMessage({ role: msgRole, text: msg, id: this.generateId() });
    } else if (msgRole !== 'system' && msg.length === 0) {
        // If no message and not a system action, stop processing
        this.chatState = ChatState.IDLE;
        return;
    }

    if (this.sendMessageHandler) {
      // Pass the raw message text, role, code, and changed status
      await this.sendMessageHandler(
        msg,
        msgRole,
        this.code,
        this.codeHasChanged
      )
      // Code sent to AI is now considered "synced" until edited again
      // Note: setCode called by the handler will also set this to false.
      // this.codeHasChanged = false;
    }

    this.chatState = ChatState.IDLE
  }

  private async playAction () {
    if (this.isRunning) return
    if (this.codeHasChanged) {
      this.runCode(this.code)
    }
    this.isRunning = true
    this.previewFrame.contentWindow.postMessage('resume', '*')
  }

  private async stopAction () {
    if (!this.isRunning) return
    this.isRunning = false
    this.previewFrame.contentWindow.postMessage('stop', '*')
  }

  private async clearAction () {
    // Add confirmation if code has changed
    if (this.codeHasChanged && this.code !== this.defaultCode) {
        const discardChanges = window.confirm(
            'You have unsaved changes in the code editor. Resetting will discard them. Are you sure?'
        );
        if (!discardChanges) {
            return; // Abort if user cancels
        }
    }
    this.setCode(this.defaultCode, null); // Reset code and active version
    this.messages = [];
    this.codeHasChanged = true; // Default code is now loaded, but treated as "changed" from nothing
    if (this.resetHandler) {
      this.resetHandler();
    }
    this.setInputField(''); // Clear input field as well
  }

  private async codeEditedAction (newCode: string) {
    if (this.chatState !== ChatState.IDLE) return

    // Only update if the code actually changed
    if (this.code === newCode) return

    this.code = newCode // Update internal code state first
    this.codeHasChanged = true
    this.codeNeedsReload = true
    this.activeCodeVersionId = null // Editing breaks link to previous version

    // Update syntax highlighting asynchronously
    this.codeSyntax.innerHTML = await marked.parse(
      '```javascript\n' + newCode + '\n```'
    )
    this.requestUpdate() // Ensure UI reflects changes (like tooltip)
  }

  private async inputKeyDownAction (e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      this.sendMessageAction()
    }
  }

  private async reloadCodeAction () {
    this.runCode(this.code)
    this.isRunning = true
    this.codeNeedsReload = false // Reloaded, so flag is off
    this.requestUpdate()
  }

  private loadVersion (id: string) {
    // Keep this check: User might edit *after* AI response/snapshot, then try to load an older version
    if (this.codeHasChanged && this.activeCodeVersionId !== id) {
      const discardChanges = window.confirm(
        'You have unsaved changes in the code editor. Loading this version will discard your current edits. Are you sure you want to proceed?'
      )
      if (!discardChanges) {
        // User clicked Cancel, so do nothing.
        console.log('Load version cancelled by user.')
        return
      }
      // User clicked OK, proceed with loading.
    }

    // Find the message and load the code (existing logic)
    const message = this.messages.find(msg => msg.id === id)
    if (message && message.code) {
      console.log(`Loading code version from message ${id}`)
      this.setCode(message.code, id) // Pass ID to track active version
      // Optionally switch to the code tab
      this.selectedChatTab = ChatTab.CODE
    } else {
      console.warn(`Could not find message or code for id: ${id}`)
    }
  }

  private toggleThinking (id: string) {
    this.messages = this.messages.map(msg =>
      msg.id === id ? { ...msg, isThinkingOpen: !msg.isThinkingOpen } : msg
    )
  }

  private downloadCodeAction() {
    const codeToDownload = this.code;
    if (!codeToDownload) {
        console.warn("No code to download.");
        // Optionally show a message to the user
        return;
    }

    // 1. Create Timestamp
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
                      (now.getMonth() + 1).toString().padStart(2, '0') +
                      now.getDate().toString().padStart(2, '0') + '-' +
                      now.getHours().toString().padStart(2, '0') +
                      now.getMinutes().toString().padStart(2, '0') +
                      now.getSeconds().toString().padStart(2, '0');

    // 2. Create Filename
    const filename = `p5js-sketch-${timestamp}.js`;

    // 3. Create Blob
    const blob = new Blob([codeToDownload], { type: 'text/javascript;charset=utf-8;' });

    // 4. Create Object URL
    const url = URL.createObjectURL(blob);

    // 5. Create Temporary Link
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden'; // Hide the link

    // 6. Append, Click, Remove Link
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 7. Revoke Object URL (important for memory management)
    URL.revokeObjectURL(url);

    console.log(`Code downloaded as ${filename}`);
  }

  render () {
    return html`<div class="playground">
      <div class="sidebar">
        <div class="selector">
          <button
            id="geminiTab"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.GEMINI
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.GEMINI
            }}>
            Gemini
          </button>
          <button
            id="codeTab"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.CODE
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.CODE
            }}>
            Code ${
              this.codeHasChanged && !this.codeNeedsReload ? ICON_EDIT : html``
            }
             ${
               this.codeNeedsReload
                 ? html`<span class="needs-reload-indicator">*</span>`
                 : html``
             }
          </button>
        </div>
        <div
          id="chat"
          class=${classMap({
            tabcontent: true,
            showtab: this.selectedChatTab === ChatTab.GEMINI
          })}>
          <div class="chat-messages">
            <!-- Render messages dynamically from the state array -->
            ${map(
              this.messages,
              msg => html`
                <div
                  class=${classMap({ /* FIX 1: Combine static and dynamic classes */
                    turn: true,
                    [`role-${msg.role}`]: true, // Use computed property name for dynamic role class
                    'active-code-version': msg.id === this.activeCodeVersionId
                  })}
                >
                  ${msg.thinkingText && msg.role === 'assistant'
                    ? html`
                        <details
                          class=${classMap({ /* FIX 2: Combine static and dynamic classes */
                            thinking: true,
                            hidden: !msg.thinkingText
                          })}
                          ?open=${msg.isThinkingOpen}
                          @toggle=${() => this.toggleThinking(msg.id)}
                        >
                          <summary>Thinking...</summary>
                          <div>${unsafeHTML(msg.thinkingText)}</div>
                        </details>
                      `
                    : ''}
                  <div class="text">${unsafeHTML(msg.text)}</div>
                  ${(msg.role === 'assistant' || msg.role === 'manual-snapshot') && msg.code
                    ? html`
                        <button
                          class="load-version-button"
                          @click=${() => this.loadVersion(msg.id)}
                          title="Load this code version"
                        >
                          ${msg.role === 'manual-snapshot' ? ICON_SNAPSHOT : ICON_LOAD} Load Version
                        </button>
                      `
                    : ''}
                  ${msg.role === 'system-ask'
                    ? html`
                        <button
                          class="improve-button"
                          @click=${(e: Event) => {
                            const button = e.target as HTMLButtonElement
                            button.style.display = 'none'
                            this.sendMessageAction(msg.text, 'SYSTEM')
                          }}
                        >
                          Improve
                        </button>
                      `
                    : ''}
                </div>
              `
            )}
            <div id="anchor"></div>
          </div>

          <div class="footer">
            <div
              id="chatStatus"
              class=${classMap({ hidden: this.chatState === ChatState.IDLE })}>
              ${
                this.chatState === ChatState.GENERATING
                  ? html`${ICON_BUSY} Generating...`
                  : html``
              }
              ${
                this.chatState === ChatState.THINKING
                  ? html`${ICON_BUSY} Thinking...`
                  : html``
              }
              ${
                this.chatState === ChatState.CODING
                  ? html`${ICON_BUSY} Coding...`
                  : html``
              }
            </div>
            <div id="inputArea">
              <textarea
                id="messageInput"
                .value=${this.inputMessage}
                @input=${(e: InputEvent) => {
                  this.inputMessage = (e.target as HTMLTextAreaElement).value
                }}
                @keydown=${(e: KeyboardEvent) => {
                  this.inputKeyDownAction(e)
                }}
                placeholder="Type your message..."
                autocomplete="off" ></textarea>
              <button
                id="sendButton"
                class=${classMap({
                  disabled: this.chatState !== ChatState.IDLE
                })}
                @click=${() => {
                  this.sendMessageAction()
                }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="30px"
                  viewBox="0 -960 960 960"
                  width="30px"
                  fill="currentColor">
                  <path d="M120-160v-240l320-80-320-80v-240l760 320-760 320Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div
          id="editor"
          class=${classMap({
            tabcontent: true,
            showtab: this.selectedChatTab === ChatTab.CODE
          })}>
          <div class="code-container">
             <!-- Render syntax highlighting based on current code -->
            ${this.codeSyntax}
            <textarea
              class="code-editor"
              contenteditable=""
              .value=${this.code} /* Bind directly to the code state */
              .readonly=${this.chatState !== ChatState.IDLE}
              @input=${(e: InputEvent) => {
                // Use input for immediate feedback
                this.codeEditedAction((e.target as HTMLTextAreaElement).value)
              }}
             ></textarea>
          </div>
        </div>
      </div>

      <div class="main-container">
        ${this.previewFrame}
        <div class="toolbar">
           <button
            id="reloadCode"
            @click=${() => {
              this.reloadCodeAction()
            }}
            title=${
              this.codeNeedsReload ? 'Reload code changes' : 'Reload sketch'
            } >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="30px"
              viewBox="0 -960 960 960"
              width="30px"
              fill="currentColor">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
            <div class="button-label">
              <p>Reload</p>
               <div
                id="reloadTooltip"
                class=${classMap({ /* FIX 3: Combine static and dynamic classes */
                  'button-tooltip': true,
                  'show-tooltip': this.codeNeedsReload
                })}>
                <p>Reload code changes</p>
              </div>
            </div>
           </button>
           <button
            id="runCode"
            class=${classMap({ disabled: this.isRunning })}
            @click=${() => {
              this.playAction()
            }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="55px"
              viewBox="0 -960 960 960"
              width="55px"
              fill="currentColor">
              <path
                d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
          </button>
          <button
            id="stop"
            class=${classMap({ disabled: !this.isRunning })}
            @click=${() => {
              this.stopAction()
            }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="55px"
              viewBox="0 -960 960 960"
              width="55px"
              fill="currentColor">
              <path
                d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
          </button>

          <button
            id="downloadCode"
            @click=${() => { this.downloadCodeAction(); }}
            title="Download sketch code" >
            ${ICON_DOWNLOAD}
            <div class="button-label">
              <p>Download</p>
            </div>
          </button>

          <button
            id="clear"
            @click=${() => {
              this.clearAction()
            }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="30px"
              viewBox="0 -960 960 960"
              width="30px"
              fill="currentColor">
              <path
                d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Zm-96 180q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Z" />
            </svg>
            <div class="button-label">
              <p>Reset</p>
            </div>
          </button>
        </div>
      </div>
    </div>`
  }
}
