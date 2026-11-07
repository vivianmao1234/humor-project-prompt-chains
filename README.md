# Lion Laughs Prompt Chains

Week 8 prompt chain tool for the Lion Laughs caption app. Superadmins (`profiles.is_superadmin`) can:

- create, rename, and delete prompt chains (`humor_flavors`) and set how many captions each writes per rating-app request (`humor_flavor_mix`)
- create, edit, delete, and reorder chain steps (`humor_flavor_steps`): prompt, model, temperature
- run a chain on a topic and see each step's output; every call is logged (`caption_requests`, `llm_prompt_chains`, `llm_model_responses`)
- see the captions a chain has produced, with vote scores
- switch between light, dark, and system themes

Shares the Supabase database with the rating app and admin area. Every route requires Google sign-in plus `is_superadmin` (proxy, each page and action, and RLS).

Setup: copy `.env.example` to `.env.local`, fill in the same Supabase values as the other apps plus a Gemini API key, then `npm install && npm run dev`.
