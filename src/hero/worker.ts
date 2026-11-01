import { createEngine, type EngineMessage, type EngineReply } from './engine.ts';

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<EngineMessage>) => void) | null;
    postMessage(message: EngineReply): void;
};

const handle = createEngine((reply) => scope.postMessage(reply));

scope.onmessage = (event) => handle(event.data);
