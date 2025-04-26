/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';
import {ChatState, marked, Playground} from './playground';

const SYSTEM_INSTRUCTIONS = `You're an expert creative coding agent specializing in p5.js for effects, games, and generative art.

## THINKING PROCESS
Before writing any code:
1. Consider the goal of the sketch and how users will interact with it (if required)
2. Identify the key algorithms or techniques needed
3. Plan the basic structure and flow of the program

## CODE STANDARDS
When writing code:
- Use p5.js instance mode with standard-js formatting
- Do not use any import statements or third-party libraries, as this is running in a browser
- Include complete code that can run in a live p5.js environment with p5.sound available
- Set a default canvas size of windowWidth x windowHeight unless specified otherwise
- Add clear, helpful comments for key sections
- Include basic error handling for common issues
- Consider mobile/desktop compatibility
- Be concise - avoid unnecessary code

## INPUT HANDLING
- Support both mouse and touch inputs where appropriate
- Include keyboard alternatives for critical interactions
- Handle window resizing gracefully
- Consider different screen sizes and aspect ratios
- Provide clear feedback for user actions

## ERROR HANDLING
- Validate user inputs before processing
- Add try/catch blocks around resource loading
- Provide meaningful feedback when errors occur
- Include fallback behaviors for common failure points
- Check for browser/feature support before using advanced features

## DOCUMENTATION
- Document all functions with clear purpose, parameters, and return values
- Explain key variables and data structures
- Include usage examples for complex functions
- Note any browser compatibility issues
- Provide setup instructions if configuration is needed

## PERFORMANCE CONSIDERATIONS
- Use efficient algorithms and data structures
- Minimize object creation in draw loops
- Consider frame rate settings for different devices
- Implement spatial partitioning for many-object simulations
- Add options to scale complexity based on device capabilities

## ACCESSIBILITY CONSIDERATIONS
- Provide text alternatives for visual elements when possible
- Ensure interactive elements are keyboard-accessible
- Use sufficient color contrast (minimum 4.5:1 ratio)
- Add aria attributes where helpful
- Include options to disable animations or reduce motion when practical
- Suggest sound/haptic feedback alternatives for visual-only experiences

## RESPONSE FORMAT
1. A brief explanation of what the code does (2-3 sentences)
2. The complete, working code block with helpful comments
3. 1-2 tips for modifying or extending the code
4. Note any specific accessibility features or limitations

## IMPLEMENTATION PRIORITY
Apply these guidelines proportionally to the complexity of the requested sketch. For simpler sketches, focus on:
1. Functional correctness and code quality
2. Basic accessibility features
3. Performance for common devices

For complex sketches, implement all guidelines with special attention to performance optimization and comprehensive documentation.

There should be no external dependencies - all functions must be included in the code or be part of the p5.js and p5.sound libraries.

Feel free to suggest better approaches if my requests could be improved, but explain your reasoning clearly.
`;

// const EMPTY_CODE = `function setup() {
//   // Setup code goes here.
//   createCanvas(windowWidth, windowHeight);
// }

// function draw() {
//   // Frame drawing code goes here.
//   background(175);
// }`;

const EMPTY_CODE = `const mySketch = function(p) {
    p.setup = () => {
    // Setup code goes here.
    createCanvas(windowWidth, windowHeight);
  }

  p.draw = () => {
    // Frame drawing code goes here.
    background(175);
  }
}
new p5(mySketch);`;

/* make a simple animation of the background color */
// const STARTUP_CODE = `function setup() {
//   createCanvas(windowWidth, windowHeight);
//   // Set color mode to HSB (Hue, Saturation, Brightness)
//   // Hue ranges from 0 to 360, Saturation and Brightness from 0 to 100
//   colorMode(HSB, 360, 100, 100);
// }

// function draw() {
//   // Calculate a hue value that changes over time
//   // Use frameCount, which increments each frame
//   // Multiply by a small number to slow down the color change
//   // Use the modulo operator (%) to wrap the hue value around 360
//   let hue = (frameCount * 0.5) % 360;

//   // Set the background color using the calculated hue
//   // Keep saturation and brightness high for vivid colors
//   background(hue, 90, 90);
// }

// // Optional: Resize the canvas if the browser window size changes
// function windowResized() {
//   resizeCanvas(windowWidth, windowHeight);
// }`;
const STARTUP_CODE = `const mySketch = function(p) {
  p.setup = function() {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB, 360, 100, 100);
  };

  p.draw = function() {
    let hue = (p.frameCount * 0.5) % 360;
    p.background(hue, 90, 90);
  };

  p.windowResized = function() {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
};

new p5(mySketch);`;

const EXAMPLE_PROMPTS = [
  'make an arcade game',
  'make a bouncing yellow ball within a square, make sure to handle collision detection properly. make the square slowly rotate. make sure ball stays within the square',
  'make a smoke simulation made of puffy trails of smoke over a green landscape',
  'create a game where a space ship shoots asteroids flying around me in space',
];

const ai = new GoogleGenAI({
  apiKey: globalThis.process.env.API_KEY,
  apiVersion: 'v1alpha',
});

function createAiChat() {
  return ai.chats.create({
    // model: 'gemini-2.5-pro-preview-03-25',
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      thinkingConfig: {
        includeThoughts: true,
      },
    },
  });
}

let aiChat = createAiChat();

function getCode(text: string) {
  const startMark = '```javascript';
  const codeStart = text.indexOf(startMark);
  let codeEnd = text.lastIndexOf('```');

  if (codeStart > -1) {
    if (codeEnd < 0) {
      codeEnd = undefined;
    }
    return text.substring(codeStart + startMark.length, codeEnd);
  }
  return '';
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const rootElement = document.querySelector('#root')! as HTMLElement;

  const playground = new Playground();
  rootElement.appendChild(playground);

  playground.sendMessageHandler = async (
    input: string, // Raw input text
    role: string, // 'user' or 'system'
    currentCode: string, // The code currently in the editor/preview
    codeHasChanged: boolean, // Flag if editor code differs from last run/loaded
  ) => {
    console.log(
      'sendMessageHandler received:',
      { input, role, codeHasChanged }
    );

    // Add a placeholder message for the assistant's response. Store its ID.
    const assistantMessageId = playground.addMessage({
        role: 'assistant',
        text: '...', // Initial placeholder text
        thinkingText: '', // Start with empty thinking text
        isThinkingOpen: true,
    });

    const historyForAI = []; // Build history for the AI call

    // Add previous messages from playground state (optional, but good for context)
    // Note: This simple version doesn't send full history, adjust if needed.

    // Add user message if code changed before sending
    if (role.toUpperCase() === 'USER' && codeHasChanged) {
      historyForAI.push({
        role: 'user',
        // Send the *current* code from the editor
        text: 'I have updated the code to:\n```javascript\n' + currentCode + '\n```\nNow, please: ' + input,
      });
    } else if (role.toUpperCase() === 'SYSTEM') {
       // System message (e.g., from runtime error)
       historyForAI.push({
         role: 'user', // Send system prompts as 'user' for the model
         text: `The p5.js runtime reported an error: "${input}". Can you fix the current code?\nCurrent code:\n\`\`\`javascript\n${currentCode}\n\`\`\``,
       });
    } else {
      // Standard user message
      historyForAI.push({
        role: 'user', // Always send user input as 'user' role
        text: input,
      });
    }


    playground.setChatState(ChatState.GENERATING); // Initial state

    let accumulatedText = '';
    let accumulatedThinking = '';
    let finalP5Code = ''; // Store the final extracted code

    try {
      // Use sendMessageStream with the constructed history
      const res = await aiChat.sendMessageStream({ message: historyForAI });

      for await (const chunk of res) {
        let thinkingUpdated = false;
        let textUpdated = false;

        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content.parts ?? []) {
            if (part.thought) {
              playground.setChatState(ChatState.THINKING);
              accumulatedThinking += part.text; // Append raw thinking text
              thinkingUpdated = true;
            } else if (part.text) {
              playground.setChatState(ChatState.CODING);
              accumulatedText += part.text; // Append raw response text
              textUpdated = true;
            }
          }
        }

        // Update the message object in the playground state after processing chunk parts
        const updates: Partial<Playground['messages'][0]> = {};
        if (thinkingUpdated) {
            updates.thinkingText = await marked.parse(accumulatedThinking); // Render markdown
            updates.isThinkingOpen = true; // Keep open while streaming
        }
        if (textUpdated) {
            // Extract code *during* streaming to potentially update preview faster (optional)
            // finalP5Code = getCode(accumulatedText);
            // Remove code block for display in chat bubble
            const explanation = accumulatedText.replace(/```javascript[\s\S]*?```/g, '*(Code block updated)*');
            updates.text = await marked.parse(explanation || '...'); // Render markdown
        }

        if (thinkingUpdated || textUpdated) {
            playground.updateMessage(assistantMessageId, updates);
        }
      }

      // --- Processing after stream finishes ---
      finalP5Code = getCode(accumulatedText); // Get final code once stream is done

      // Final update to the message object
      const finalUpdates: Partial<Playground['messages'][0]> = {
          isThinkingOpen: false, // Close thinking details
      };

      // Update text one last time, ensuring code block is replaced
       const finalExplanation = accumulatedText.replace(/```javascript[\s\S]*?```/g, '*(Code block displayed in Code tab)*');
       finalUpdates.text = await marked.parse(finalExplanation || 'Done.'); // Final rendered text

      if (finalP5Code.trim().length > 0) {
        finalUpdates.code = finalP5Code; // Store the raw code string
        playground.setCode(finalP5Code, assistantMessageId); // Set code in editor/preview and link to this message
      } else {
         // If no code was generated, maybe add a system message?
         // Or just leave the text as is.
         console.log("Assistant response did not contain executable code.");
         // Ensure the active version is cleared if no new code is set
         if (playground.activeCodeVersionId === assistantMessageId) {
             playground.activeCodeVersionId = null;
         }
      }

      playground.updateMessage(assistantMessageId, finalUpdates);


    } catch (e: GoogleGenAI.ClientError) { // Use specific type if available
      console.error('GenAI SDK Error:', e);
      let errorMessage = e.message || 'An unknown error occurred.';
       // Attempt to parse detailed error (keep existing parsing logic)
       const splitPos = errorMessage.indexOf('{');
        if (splitPos > -1) {
            const msgJson = errorMessage.substring(splitPos);
            try {
            const sdkError = JSON.parse(msgJson);
            if (sdkError.error && sdkError.error.message) {
                errorMessage = await marked.parse(sdkError.error.message);
            } else {
                 errorMessage = await marked.parse(errorMessage);
            }
            } catch (parseError) {
            console.error('Unable to parse the error message JSON:', parseError);
             errorMessage = await marked.parse(errorMessage); // Fallback to raw message
            }
        } else {
             errorMessage = await marked.parse(errorMessage); // Fallback to raw message
        }

      // Update the placeholder message to show the error
      playground.updateMessage(assistantMessageId, {
          role: 'error', // Change role to error
          text: errorMessage,
          thinkingText: '', // Clear thinking
          isThinkingOpen: false,
      });

    } finally {
       playground.setChatState(ChatState.IDLE); // Ensure state is reset
       playground.scrollToTheEnd(); // Scroll after final updates
    }
  };

  playground.resetHandler = async () => {
    aiChat = createAiChat(); // Reset AI chat session
    console.log('Chat session reset.');
  };

  // --- Initial Setup ---
  playground.setDefaultCode(EMPTY_CODE);

  // Add initial messages using the new structure
  const initialUserMsgId = playground.addMessage({
      role: 'user',
      text: 'make a simple animation of the background color',
  });
   const initialAssistantMsgId = playground.addMessage({
      role: 'assistant',
      text: 'Here you go! *(Code block displayed in Code tab)*', // Initial text
      code: STARTUP_CODE, // Store the initial code with this message
  });

  // Set the initial code and link it to the assistant message
  playground.setCode(STARTUP_CODE, initialAssistantMsgId);

  // Set initial input field example
  playground.setInputField(
    'Start from scratch and ' +
      EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)],
  );

  // Initial scroll to end
  playground.scrollToTheEnd();
});