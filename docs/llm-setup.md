# LLM Integration Setup

The Passage Planner now supports natural language processing through integration with OpenAI or Anthropic Claude.

## Configuration

### Option 1: OpenAI (Recommended)

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to your `.env` file:
   ```
   OPENAI_API_KEY=sk-...your-key-here...
   ```
3. The system will use GPT-4 Turbo by default

### Option 2: Anthropic Claude

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to your `.env` file:
   ```
   ANTHROPIC_API_KEY=sk-ant-...your-key-here...
   ```
3. The system will use Claude 3 Opus by default

## Features

With LLM integration enabled:

- **Natural Language Understanding**: The chat understands requests like:
  - "I need to sail from Boston to Portland next Tuesday"
  - "Plan a passage from Miami to Nassau, avoiding night sailing"
  - "What's the best route from Charleston to Savannah in calm conditions?"

- **Intelligent Response Generation**: Instead of formatted data, you get conversational responses:
  - Weather summaries in plain English
  - Safety recommendations based on conditions
  - Alternative route suggestions

- **Context Awareness**: The LLM understands sailing terminology and can extract:
  - Departure and destination ports
  - Preferred departure times
  - Weather preferences (max wind speed, wave height)
  - Special requirements (daylight only, etc.)

## Testing

1. Install dependencies:
   ```bash
   cd orchestrator
   npm install
   ```

2. Restart the mock server:
   ```bash
   pkill -f "ts-node src/mock-server"
   npx ts-node src/mock-server.ts
   ```

3. Check the health endpoint:
   ```bash
   curl http://localhost:8080/health
   ```
   
   You should see `"llmEnabled": true` if configured correctly.

4. Try natural language requests in the chat interface!

## Fallback Behavior

If no LLM API key is configured:
- The system will attempt basic keyword parsing
- Responses will be formatted data rather than natural language
- A message will indicate that LLM is not configured

## Cost Considerations

- **OpenAI GPT-4 Turbo**: ~$0.01 per request
- **Anthropic Claude 3 Opus**: ~$0.015 per request

Both providers offer usage-based pricing. Monitor your usage in their respective dashboards.

## Troubleshooting

1. **"LLM provider not configured"**: Check that your API key is set in `.env`
2. **Rate limiting**: Both providers have rate limits. Consider implementing caching for repeated requests
3. **Timeout errors**: Complex requests may take 5-10 seconds. The frontend shows a loading state during processing 