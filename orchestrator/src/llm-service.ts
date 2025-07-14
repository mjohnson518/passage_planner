import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

export interface PassageRequest {
  departure: string;
  destination: string;
  departureTime?: string;
  preferences?: {
    avoidNight?: boolean;
    maxWindSpeed?: number;
    maxWaveHeight?: number;
  };
}

export class LLMService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private provider: 'openai' | 'anthropic';
  private model: string;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    
    if (config.provider === 'openai') {
      this.openai = new OpenAI({ apiKey: config.apiKey });
      this.model = config.model || 'gpt-4-turbo-preview';
    } else {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
      this.model = config.model || 'claude-3-opus-20240229';
    }
  }

  async parsePassageRequest(userMessage: string): Promise<PassageRequest> {
    const systemPrompt = `You are a maritime passage planning assistant. Parse the user's natural language request for a sailing passage and extract the key information.

Return a JSON object with the following structure:
{
  "departure": "port name or location",
  "destination": "port name or location", 
  "departureTime": "ISO 8601 datetime if specified",
  "preferences": {
    "avoidNight": true/false if mentioned,
    "maxWindSpeed": number in knots if specified,
    "maxWaveHeight": number in meters if specified
  }
}

If any information is not provided, omit that field. Always include departure and destination.`;

    try {
      let response: string;
      
      if (this.provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });
        
        response = completion.choices[0].message.content || '{}';
        
      } else if (this.provider === 'anthropic' && this.anthropic) {
        const completion = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 1000,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        });
        
        response = completion.content[0].type === 'text' ? completion.content[0].text : '{}';
      } else {
        throw new Error('LLM provider not configured');
      }

      return JSON.parse(response);
    } catch (error) {
      console.error('Error parsing passage request:', error);
      // Fallback to basic parsing
      return this.basicParsing(userMessage);
    }
  }

  async generatePassageResponse(passagePlan: any): Promise<string> {
    const systemPrompt = `You are a friendly and knowledgeable maritime passage planning assistant. 
    Convert the provided passage plan data into a natural, conversational response.
    Include key information like distance, estimated time, weather conditions, and any important waypoints.
    Be helpful and mention any safety considerations or recommendations.`;

    const userPrompt = `Here's the passage plan data: ${JSON.stringify(passagePlan, null, 2)}`;

    try {
      if (this.provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
        });
        
        return completion.choices[0].message.content || 'I have created your passage plan.';
        
      } else if (this.provider === 'anthropic' && this.anthropic) {
        const completion = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 2000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });
        
        return completion.content[0].type === 'text' 
          ? completion.content[0].text 
          : 'I have created your passage plan.';
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }

    // Fallback response
    return this.generateFallbackResponse(passagePlan);
  }

  private basicParsing(message: string): PassageRequest {
    // Basic keyword extraction as fallback
    const lower = message.toLowerCase();
    
    // Try to extract departure and destination
    const fromMatch = message.match(/from\s+([^to]+?)(?:\s+to|$)/i);
    const toMatch = message.match(/to\s+([^.!?]+)/i);
    
    const departure = fromMatch ? fromMatch[1].trim() : 'Unknown';
    const destination = toMatch ? toMatch[1].trim() : 'Unknown';
    
    // Extract time if mentioned
    const timeMatch = message.match(/(?:at|on|leaving|departing)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?|\w+day)/i);
    const departureTime = timeMatch ? new Date().toISOString() : undefined;
    
    return {
      departure,
      destination,
      departureTime,
      preferences: {
        avoidNight: lower.includes('avoid night') || lower.includes('daylight'),
        maxWindSpeed: lower.includes('calm') ? 15 : undefined,
      }
    };
  }

  private generateFallbackResponse(plan: any): string {
    const { departure, destination, distance, estimatedArrivalTime, weather, waypoints } = plan;
    
    let response = `I have planned your passage from ${departure.name} to ${destination.name}. `;
    response += `The total distance is ${distance.total} ${distance.unit}. `;
    
    if (estimatedArrivalTime) {
      const arrival = new Date(estimatedArrivalTime);
      response += `You should arrive around ${arrival.toLocaleString()}. `;
    }
    
    if (weather?.conditions?.[0]) {
      const condition = weather.conditions[0];
      response += `\n\nWeather: ${condition.description} with winds from the ${condition.windDirection} at ${condition.windSpeed} knots. `;
      response += `Wave height is expected to be ${condition.waveHeight} meters. `;
    }
    
    if (waypoints?.length > 0) {
      response += `\n\nYour route includes ${waypoints.length} waypoints`;
      if (waypoints[0]?.name) {
        response += `, starting with ${waypoints[0].name}`;
      }
      response += '. ';
    }
    
    response += '\n\nHave a safe passage!';
    
    return response;
  }
} 