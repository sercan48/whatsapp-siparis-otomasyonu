/**
 * AI Image Generation API Service
 * Supports: OpenAI DALL-E, Replicate (Stable Diffusion), FAL.ai
 */

// API Provider configurations
const PROVIDERS = {
    openai: {
        name: 'OpenAI DALL-E 3',
        endpoint: 'https://api.openai.com/v1/images/generations',
        models: ['dall-e-3', 'dall-e-2'],
        sizes: {
            story: '1024x1792',  // 9:16 portrait
            post: '1024x1024'    // 1:1 square
        }
    },
    replicate: {
        name: 'Replicate (Stable Diffusion)',
        endpoint: 'https://api.replicate.com/v1/predictions',
        models: ['stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b']
    },
    fal: {
        name: 'FAL.ai (Fast)',
        endpoint: 'https://fal.run/fal-ai/flux/schnell'
    }
};

/**
 * Generate image using OpenAI DALL-E
 */
import { supabase } from './supabaseClient';

/**
 * Generate image using OpenAI DALL-E (via Supabase Edge Function)
 */
export const generateWithOpenAI = async (prompt, options = {}) => {
    const {
        model = 'dall-e-3',
        size = '1024x1024',
        quality = 'hd',
        style = 'vivid'
    } = options;

    // Call Supabase Edge Function 'generate-image'
    // This securely handles the API key on the backend
    const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
            prompt,
            model,
            size,
            quality, // Note: DALL-E 3 only supports 'standard' or 'hd', Edge Function might map it
            style,
            n: 1
        }
    });

    if (error) {
        console.error('Edge Function Error:', error);
        throw new Error(error.message || 'Image generation failed');
    }

    if (data.error) {
        throw new Error(data.error.message || 'OpenAI API error');
    }

    // OpenAI return format is typically { data: [{ url: "..." }] }
    // The Edge Function proxies this response
    return {
        imageUrl: data.created ? data.data[0].url : data.data[0].url, // Handle potential response variations
        revisedPrompt: data.data[0].revised_prompt
    };
};

/**
 * Generate image using Replicate (Stable Diffusion XL)
 */
export const generateWithReplicate = async (prompt, options = {}) => {
    const {
        apiKey,
        width = 1024,
        height = 1024,
        numOutputs = 1
    } = options;

    if (!apiKey) {
        throw new Error('Replicate API key is required');
    }

    // Start prediction
    const startResponse = await fetch(PROVIDERS.replicate.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${apiKey}`
        },
        body: JSON.stringify({
            version: PROVIDERS.replicate.models[0].split(':')[1],
            input: {
                prompt,
                width,
                height,
                num_outputs: numOutputs,
                scheduler: 'K_EULER',
                num_inference_steps: 30,
                guidance_scale: 7.5
            }
        })
    });

    if (!startResponse.ok) {
        throw new Error('Replicate API error');
    }

    const prediction = await startResponse.json();

    // Poll for completion
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pollResponse = await fetch(result.urls.get, {
            headers: { 'Authorization': `Token ${apiKey}` }
        });
        result = await pollResponse.json();
    }

    if (result.status === 'failed') {
        throw new Error(result.error || 'Generation failed');
    }

    return {
        imageUrl: result.output[0],
        revisedPrompt: prompt
    };
};

/**
 * Generate image using FAL.ai (Flux - very fast)
 */
export const generateWithFal = async (prompt, options = {}) => {
    const {
        apiKey,
        imageSize = 'landscape_16_9',
        numImages = 1
    } = options;

    if (!apiKey) {
        throw new Error('FAL API key is required');
    }

    const response = await fetch(PROVIDERS.fal.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${apiKey}`
        },
        body: JSON.stringify({
            prompt,
            image_size: imageSize,
            num_images: numImages,
            enable_safety_checker: true
        })
    });

    if (!response.ok) {
        throw new Error('FAL API error');
    }

    const data = await response.json();
    return {
        imageUrl: data.images[0].url,
        revisedPrompt: prompt
    };
};

/**
 * Universal image generation function
 */
export const generateImage = async (prompt, options = {}) => {
    const { provider = 'openai', format = 'post', ...providerOptions } = options;

    // Adjust size based on format
    let adjustedOptions = { ...providerOptions };

    if (provider === 'openai') {
        adjustedOptions.size = PROVIDERS.openai.sizes[format] || '1024x1024';
    } else if (provider === 'replicate') {
        if (format === 'story') {
            adjustedOptions.width = 768;
            adjustedOptions.height = 1344;
        } else {
            adjustedOptions.width = 1024;
            adjustedOptions.height = 1024;
        }
    } else if (provider === 'fal') {
        adjustedOptions.imageSize = format === 'story' ? 'portrait_16_9' : 'square';
    }

    switch (provider) {
        case 'openai':
            return generateWithOpenAI(prompt, adjustedOptions);
        case 'replicate':
            return generateWithReplicate(prompt, adjustedOptions);
        case 'fal':
            return generateWithFal(prompt, adjustedOptions);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
};

/**
 * Get available providers
 */
export const getProviders = () => [
    { id: 'openai', name: 'OpenAI DALL-E 3', speed: 'Orta', quality: 'En İyi', price: '~$0.04/görsel' },
    { id: 'replicate', name: 'Stable Diffusion XL', speed: 'Yavaş', quality: 'Çok İyi', price: '~$0.01/görsel' },
    { id: 'fal', name: 'FAL Flux (Hızlı)', speed: 'Çok Hızlı', quality: 'İyi', price: '~$0.01/görsel' }
];

export default {
    generateImage,
    generateWithOpenAI,
    generateWithReplicate,
    generateWithFal,
    getProviders,
    PROVIDERS
};
