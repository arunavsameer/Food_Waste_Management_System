import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS (Allows your React app to talk to this function)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Receive the file from your React frontend
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
      });
    }

    // 3. Convert the file into a format Gemini can read (Base64)
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = encodeBase64(new Uint8Array(arrayBuffer));
    const mimeType = file.type || 'application/pdf';

    // 4. Send the file and instructions to Google Gemini
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "You are an expert data extractor. The provided document contains exactly TWO weekly meal menus, typically split across two pages. Extract both menus sequentially. Return ONLY a JSON object with exactly two keys: 'week1' and 'week2'. 'week1' MUST contain the data from the very first menu table (Page 1). 'week2' MUST contain the data from the second menu table (Page 2). Both keys must contain an array of objects representing the days. Each object must have these keys exactly: 'day' (e.g., 'Monday'), 'breakfast', 'lunch', and 'dinner'. If a meal is empty, leave it as an empty string. Do not include markdown formatting." },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API failed');

    // 5. Clean up the response and send it back to React
    const textContent = data.candidates[0].content.parts[0].text;
    const parsedMenu = JSON.parse(textContent);

    return new Response(JSON.stringify({ parsedMenu }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});