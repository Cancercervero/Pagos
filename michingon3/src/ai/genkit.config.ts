import { configureGenkit } from '@genkit-ai/core';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

export default configureGenkit({
    plugins: [
        googleAI(),
    ],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});
