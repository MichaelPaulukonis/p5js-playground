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
- Include complete code that can run in a live p5.js environment
- Set a default canvas size of windowWidth x windowHeight unless specified otherwise
- Add clear, helpful comments for key sections
- Include basic error handling for common issues
- Consider mobile/desktop compatibility
- Be concise - avoid unnecessary code

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

There should be no external dependencies - all functions must be included in the code or be part of the p5.js library.

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
    input: string,
    role: string,
    code: string,
    codeHasChanged: boolean,
  ) => {
    console.log(
      'sendMessageHandler',
      input,
      role,
      code,
      'codeHasChanged:',
      codeHasChanged,
    );

    const {thinking, text} = playground.addMessage('assistant', '');
    const message = [];

    if (role.toUpperCase() === 'USER' && codeHasChanged) {
      message.push({
        role: 'user',
        text: 'I have updated the code: ```javascript\n' + code + '\n```',
      });
    }

    if (role.toUpperCase() === 'SYSTEM') {
      message.push({
        role: 'user',
        text: `Interpreter reported: ${input}. Is it possible to improve that?`,
      });
    } else {
      message.push({
        role,
        text: input,
      });
    }

    playground.setChatState(ChatState.GENERATING);

    text.innerHTML = '...';

    let newCode = '';
    let thought = '';

    try {
      const res = await aiChat.sendMessageStream({message});

      for await (const chunk of res) {
        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content.parts ?? []) {
            if (part.thought) {
              playground.setChatState(ChatState.THINKING);
              thought += part.text;
              thinking.innerHTML = await marked.parse(thought);
              thinking.parentElement.classList.remove('hidden');
            } else if (part.text) {
              playground.setChatState(ChatState.CODING);
              newCode += part.text;
              const p5Code = getCode(newCode);

              // Remove the code block, it is available in the Code tab
              const explanation = newCode.replace(
                '```javascript' + p5Code + '```',
                '',
              );

              text.innerHTML = await marked.parse(explanation);
            }
            playground.scrollToTheEnd();
          }
        }
      }
    } catch (e: GoogleGenAI.ClientError) {
      console.error('GenAI SDK Error:', e.message);
      let message = e.message;
      const splitPos = e.message.indexOf('{');
      if (splitPos > -1) {
        const msgJson = e.message.substring(splitPos);
        try {
          const sdkError = JSON.parse(msgJson);
          if (sdkError.error) {
            message = sdkError.error.message;
            message = await marked.parse(message);
          }
        } catch (e) {
          console.error('Unable to parse the error message:', e);
        }
      }
      const {text} = playground.addMessage('error', '');
      text.innerHTML = message;
    }

    // close thinking block
    thinking.parentElement.removeAttribute('open');

    // If the answer was just code
    if (text.innerHTML.trim().length === 0) {
      text.innerHTML = 'Done';
    }

    const p5Code = getCode(newCode);
    if (p5Code.trim().length > 0) {
      playground.setCode(p5Code);
    } else {
      playground.addMessage('SYSTEM', 'There is no new code update.');
    }
    playground.setChatState(ChatState.IDLE);
  };

  playground.resetHandler = async () => {
    aiChat = createAiChat();
  };

  playground.setDefaultCode(EMPTY_CODE);
  playground.addMessage(
    'USER',
    'make a simple animation of the background color',
  );
  playground.addMessage('ASSISTANT', 'Here you go!');
  playground.setCode(STARTUP_CODE);
  playground.setInputField(
    'Start from scratch and ' +
      EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)],
  );
});
