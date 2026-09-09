# AI Marinade Assistant — Demo for Management

## 1. Goal

Build a very simple working demo website to present the idea of an AI assistant for a marinade company.

This is **not** a production website and **not** a design showcase.
The priority is to demonstrate the business idea quickly:

1. A visitor opens the marinade website.
2. The visitor can browse dry and liquid marinades.
3. The visitor opens an AI chat assistant.
4. The visitor describes what they need in natural language.
5. The AI assistant recommends only real products from the demo catalog.
6. The visitor clicks a recommended marinade.
7. The website opens the correct catalog page, scrolls to the exact product card, and visually highlights it.

Keep the project small, simple, readable, and quick to build.

---

## 2. Technology

Use:

- Vite
- Vanilla JavaScript ES Modules
- HTML5
- SCSS
- BEM naming
- no React
- no TypeScript unless absolutely necessary
- responsive layout

For the AI request use a server-side endpoint:

- `/api/assistant`

The AI API key must never be exposed in browser JavaScript.
Store it only as a server environment variable.

Recommended demo deployment:

- frontend + serverless API in one Vercel project

The frontend must still work without AI if the API key is missing: catalog navigation must remain functional and the chat should show a clear demo error message instead of breaking the website.

---

## 3. Main principle

The AI assistant must **never invent products**.

The catalog is the source of truth.

AI may only recommend products whose IDs exist in the local product data.

The final recommendation should be validated by application code before it is shown to the user.

If AI returns an unknown product ID, ignore it.

---

## 4. Site structure

Create these pages:

```text
/index.html
/catalog.html
/dry.html
/liquid.html
```

### Page 1 — Home

`index.html`

Very simple page.

Required:

- header
- company/demo logo text
- hero section
- short headline
- short description
- button `View Marinade Catalog`
- floating AI chat button

Example content:

```text
Premium Marinades for Food Production

Find the right dry or liquid marinade for chicken, pork or fish.
Use our AI assistant to find the best match by color and flavor.
```

CTA:

```text
View Marinade Catalog
```

CTA opens:

```text
/catalog.html
```

Do not spend time on complicated visuals or animations.
A clean neutral layout is enough.

---

## 5. Catalog choice page

`catalog.html`

Show two large category cards:

### Dry Marinades

Description:

```text
Dry seasoning blends for chicken, pork and fish.
```

Button:

```text
View Dry Marinades
```

Link:

```text
/dry.html
```

### Liquid Marinades

Description:

```text
Liquid marinades for chicken, pork and fish.
```

Button:

```text
View Liquid Marinades
```

Link:

```text
/liquid.html
```

Also keep the floating AI assistant available on this page.

---

## 6. Dry marinades page

`dry.html`

Create exactly 10 demo product cards.

Use only these product colors:

- yellow
- red
- green

Use only these main food types:

- chicken
- pork
- fish

Products must have different flavor combinations.

Use the following demo catalog.

### DRY-01

```text
ID: dry-golden-garlic-chicken
Name: Golden Garlic Chicken
Type: dry
Color: yellow
For: chicken
Flavor: garlic, herbs, mild pepper
Sweetness: 1/5
Spiciness: 1/5
Description: Mild golden dry marinade with garlic and herbs for chicken.
```

### DRY-02

```text
ID: dry-honey-curry-chicken
Name: Honey Curry Chicken
Type: dry
Color: yellow
For: chicken
Flavor: curry, honey, warm spices
Sweetness: 4/5
Spiciness: 2/5
Description: Yellow curry-style blend with a sweet honey note.
```

### DRY-03

```text
ID: dry-golden-pepper-pork
Name: Golden Pepper Pork
Type: dry
Color: yellow
For: pork
Flavor: pepper, onion, mustard
Sweetness: 1/5
Spiciness: 2/5
Description: Savory yellow blend for pork with pepper and mustard notes.
```

### DRY-04

```text
ID: dry-red-bbq-chicken
Name: Red BBQ Chicken
Type: dry
Color: red
For: chicken
Flavor: BBQ, paprika, smoke
Sweetness: 3/5
Spiciness: 2/5
Description: Red smoky BBQ seasoning for grilled or roasted chicken.
```

### DRY-05

```text
ID: dry-red-chili-pork
Name: Red Chili Pork
Type: dry
Color: red
For: pork
Flavor: chili, paprika, garlic
Sweetness: 1/5
Spiciness: 4/5
Description: Strong red spicy blend for pork.
```

### DRY-06

```text
ID: dry-sweet-paprika-pork
Name: Sweet Paprika Pork
Type: dry
Color: red
For: pork
Flavor: sweet paprika, onion, mild smoke
Sweetness: 4/5
Spiciness: 1/5
Description: Sweet red paprika blend with mild smoky notes.
```

### DRY-07

```text
ID: dry-red-fish-paprika
Name: Red Paprika Fish
Type: dry
Color: red
For: fish
Flavor: paprika, lemon pepper, herbs
Sweetness: 1/5
Spiciness: 2/5
Description: Bright red seasoning for fish with paprika and lemon pepper.
```

### DRY-08

```text
ID: dry-green-herb-fish
Name: Green Herb Fish
Type: dry
Color: green
For: fish
Flavor: dill, parsley, lemon, herbs
Sweetness: 0/5
Spiciness: 1/5
Description: Fresh green herb blend created for fish.
```

### DRY-09

```text
ID: dry-green-garlic-chicken
Name: Green Garlic Chicken
Type: dry
Color: green
For: chicken
Flavor: parsley, garlic, herbs
Sweetness: 0/5
Spiciness: 1/5
Description: Green garlic and herb blend for chicken.
```

### DRY-10

```text
ID: dry-green-herb-pork
Name: Green Herb Pork
Type: dry
Color: green
For: pork
Flavor: herbs, garlic, black pepper
Sweetness: 0/5
Spiciness: 2/5
Description: Savory green herb seasoning for pork.
```

---

## 7. Liquid marinades page

`liquid.html`

Create exactly 10 demo product cards.

Use only these colors:

- yellow
- red
- green

Use only:

- chicken
- pork
- fish

### LIQUID-01

```text
ID: liquid-golden-honey-chicken
Name: Golden Honey Chicken
Type: liquid
Color: yellow
For: chicken
Flavor: honey, mustard, mild garlic
Sweetness: 4/5
Spiciness: 1/5
Description: Sweet golden liquid marinade for chicken.
```

### LIQUID-02

```text
ID: liquid-yellow-curry-chicken
Name: Yellow Curry Chicken
Type: liquid
Color: yellow
For: chicken
Flavor: curry, ginger, mild chili
Sweetness: 2/5
Spiciness: 2/5
Description: Yellow curry liquid marinade with gentle heat.
```

### LIQUID-03

```text
ID: liquid-golden-mustard-pork
Name: Golden Mustard Pork
Type: liquid
Color: yellow
For: pork
Flavor: mustard, honey, pepper
Sweetness: 3/5
Spiciness: 2/5
Description: Golden mustard-style liquid marinade for pork.
```

### LIQUID-04

```text
ID: liquid-red-bbq-chicken
Name: Red BBQ Chicken
Type: liquid
Color: red
For: chicken
Flavor: BBQ, smoke, sweet paprika
Sweetness: 3/5
Spiciness: 2/5
Description: Red BBQ liquid marinade for chicken and grilling.
```

### LIQUID-05

```text
ID: liquid-red-chili-pork
Name: Red Chili Pork
Type: liquid
Color: red
For: pork
Flavor: chili, garlic, paprika
Sweetness: 1/5
Spiciness: 4/5
Description: Spicy red liquid marinade for pork.
```

### LIQUID-06

```text
ID: liquid-red-sweet-pork
Name: Sweet Red Pork
Type: liquid
Color: red
For: pork
Flavor: sweet paprika, tomato, smoke
Sweetness: 4/5
Spiciness: 1/5
Description: Sweet red liquid marinade for pork.
```

### LIQUID-07

```text
ID: liquid-red-lemon-fish
Name: Red Lemon Fish
Type: liquid
Color: red
For: fish
Flavor: paprika, lemon, herbs
Sweetness: 1/5
Spiciness: 1/5
Description: Red lemon and herb liquid marinade for fish.
```

### LIQUID-08

```text
ID: liquid-green-herb-fish
Name: Green Herb Fish
Type: liquid
Color: green
For: fish
Flavor: dill, parsley, lemon
Sweetness: 0/5
Spiciness: 1/5
Description: Fresh green liquid herb marinade for fish.
```

### LIQUID-09

```text
ID: liquid-green-garlic-chicken
Name: Green Garlic Chicken
Type: liquid
Color: green
For: chicken
Flavor: garlic, parsley, herbs
Sweetness: 0/5
Spiciness: 1/5
Description: Green herb and garlic liquid marinade for chicken.
```

### LIQUID-10

```text
ID: liquid-green-pepper-pork
Name: Green Pepper Pork
Type: liquid
Color: green
For: pork
Flavor: green herbs, pepper, garlic
Sweetness: 0/5
Spiciness: 3/5
Description: Green herb marinade for pork with a stronger pepper note.
```

---

## 8. Product data

Do not hardcode product cards independently in four different places.

Create one shared product data source, for example:

```text
/data/marinades.js
```

Each product should contain at least:

```js
{
  id: 'dry-golden-garlic-chicken',
  name: 'Golden Garlic Chicken',
  type: 'dry',
  color: 'yellow',
  meat: 'chicken',
  flavors: ['garlic', 'herbs', 'mild pepper'],
  sweetness: 1,
  spiciness: 1,
  description: 'Mild golden dry marinade with garlic and herbs for chicken.',
  page: 'dry.html'
}
```

Render the catalog cards from this data.

The AI endpoint must use the same catalog data.

---

## 9. Product card design

Keep cards simple.

Each product card must show:

- color indicator
- product name
- Dry / Liquid
- Chicken / Pork / Fish
- flavor tags
- sweetness score
- spiciness score
- short description

Each card HTML element must use the product ID as its DOM ID:

```html
<article id="dry-golden-garlic-chicken" class="product-card">
```

Do not use product photography for this demo unless it is trivial.

A simple visual color block is enough:

- yellow product → yellow swatch
- red product → red swatch
- green product → green swatch

---

## 10. AI assistant UI

Add a floating button on all pages.

Example button text:

```text
AI Marinade Assistant
```

On click, open a simple chat panel.

The panel needs:

- title
- close button
- conversation area
- text input
- send button
- loading state

Welcome text:

```text
Tell me what you want to marinate.
For example: “I need a yellow marinade for chicken, slightly sweet and mildly spicy.”
```

The assistant must understand normal natural-language requests.

Examples:

```text
I need a yellow marinade for chicken, sweet and a little spicy.
```

```text
I need something green for fish with herbs and lemon.
```

```text
I want a red spicy marinade for pork.
```

```text
For chicken, something smoky and red. Dry is preferred.
```

The assistant should respond in the language used by the visitor when practical.

For the demo, English, Ukrainian and Russian input should work.

---

## 11. AI behavior

The AI assistant is a marinade-selection assistant.

Its task is to identify preferences such as:

```text
type: dry / liquid / any
meat: chicken / pork / fish
color: yellow / red / green
flavors
sweetness
spiciness
```

Then recommend 1 to 3 best matching products.

Do not require every field.

If enough information exists, recommend immediately.

If the request is too vague, ask one useful clarification question.

Example:

User:

```text
I need a marinade for chicken.
```

Assistant:

```text
Sure. Do you prefer yellow, red or green, and what kind of flavor would you like?
```

User:

```text
Yellow, sweet and slightly spicy.
```

Assistant may recommend:

```text
Golden Honey Chicken
Honey Curry Chicken
Yellow Curry Chicken
```

Only recommend existing catalog products.

---

## 12. Required AI response format

The server should ask the AI model for structured JSON only.

Use a response concept similar to:

```json
{
  "message": "I found three marinades that match your request.",
  "recommendations": [
    {
      "id": "liquid-golden-honey-chicken",
      "reason": "Yellow liquid marinade for chicken with strong sweetness and mild spice."
    },
    {
      "id": "dry-honey-curry-chicken",
      "reason": "Yellow dry chicken marinade with honey, curry and mild heat."
    }
  ]
}
```

Rules:

- `recommendations` may contain 0 to 3 items
- every `id` must exist in the catalog
- validate all IDs on the server
- never trust an unknown returned ID
- send only validated products to the browser

The server may add full product data after validation so the browser does not have to trust model-generated names, page URLs or metadata.

Preferred final server response:

```json
{
  "message": "I found two good matches.",
  "products": [
    {
      "id": "liquid-golden-honey-chicken",
      "name": "Golden Honey Chicken",
      "page": "liquid.html",
      "reason": "Yellow, sweet and mild for chicken."
    }
  ]
}
```

---

## 13. AI system instruction

Use a system instruction with the following intent:

```text
You are an AI marinade selection assistant for a demo marinade catalog.

Your job is to help users choose the most suitable marinade from the provided catalog.

Use ONLY products from the provided catalog.
Never invent product names or IDs.
Never claim that a product exists if it is not in the catalog.

Analyze the user's preferences, including when available:
- dry or liquid
- chicken, pork or fish
- yellow, red or green color
- flavor preferences
- sweetness
- spiciness

Recommend a maximum of 3 products.
Choose the closest matches when there is no perfect match.
Briefly explain why each recommendation fits.

If the request is too vague to make a useful recommendation, ask one concise clarification question.

Respond in the user's language when practical.
Return only the required structured JSON format.
```

Pass the actual product catalog to the model from the server.

---

## 14. AI endpoint

Create:

```text
/api/assistant.js
```

Expected request:

```http
POST /api/assistant
Content-Type: application/json
```

Example body:

```json
{
  "message": "I want a yellow sweet marinade for chicken with mild spice.",
  "history": []
}
```

Server responsibilities:

1. validate input
2. load the real demo catalog
3. call the AI provider
4. receive structured output
5. validate returned product IDs against the catalog
6. map the IDs to real product data
7. return safe structured JSON to the frontend
8. handle API errors gracefully

Keep conversation history small for this demo.
Only send the latest relevant messages.

---

## 15. API security

Never place an AI API key in:

```text
src/
public/
HTML
browser JavaScript
Git repository
```

Read it on the server from an environment variable, for example:

```text
OPENAI_API_KEY
```

Also create:

```text
.env.example
```

with:

```text
OPENAI_API_KEY=your_api_key_here
```

Never commit the real `.env` file.

Ensure `.env` is included in `.gitignore`.

---

## 16. Recommendation UI

Do not display AI recommendations as plain text only.

For every recommended product, render a small clickable recommendation card inside the chat.

Example:

```text
Golden Honey Chicken
Liquid · Chicken · Yellow
Honey · Mustard · Mild Garlic

Why it matches:
Sweet yellow marinade for chicken with low spiciness.

[Open marinade]
```

The `Open marinade` button must use the real product data returned by the server.

---

## 17. Deep link to a product

When the visitor clicks a product recommended by AI:

Example product:

```text
liquid-golden-honey-chicken
```

Navigate to:

```text
/liquid.html#liquid-golden-honey-chicken
```

For a dry product:

```text
/dry.html#dry-honey-curry-chicken
```

On page load:

1. read `window.location.hash`
2. find the matching product card
3. scroll it into the center of the viewport
4. apply a temporary highlight class

Example:

```css
.product-card--highlighted
```

The highlight should remain visible for approximately 2–3 seconds.

If the product card is already on the current page, scroll directly to it without a full page reload when practical.

---

## 18. Demo conversations that must work

### Test 1

User:

```text
I need a yellow marinade for chicken. Sweet and only slightly spicy.
```

Expected behavior:

- recommend yellow chicken products
- prioritize higher sweetness
- avoid strongly spicy products
- show 1–3 results

Possible matches:

```text
Golden Honey Chicken
Honey Curry Chicken
Yellow Curry Chicken
```

### Test 2

User:

```text
Give me something red and spicy for pork.
```

Possible matches:

```text
Red Chili Pork — dry
Red Chili Pork — liquid
```

### Test 3

User:

```text
I need a green marinade for fish with herbs and lemon.
```

Possible matches:

```text
Green Herb Fish — dry
Green Herb Fish — liquid
```

### Test 4

User:

```text
I want a smoky red dry seasoning for chicken.
```

Expected:

```text
Red BBQ Chicken — dry
```

### Test 5

User:

```text
I need something for pork.
```

Expected:

- do not randomly recommend immediately if the match is too broad
- ask for color/flavor preference

---

## 19. Simple header

Use the same simple header on all pages.

Navigation:

```text
Home
Catalog
Dry Marinades
Liquid Marinades
AI Assistant
```

`AI Assistant` opens the chat instead of navigating away.

---

## 20. Responsive behavior

The demo must work at least on:

- desktop
- tablet
- mobile

Simple responsive rules are enough.

Suggested product grids:

```text
Desktop: 3 cards per row
Tablet: 2 cards per row
Mobile: 1 card per row
```

AI chat:

```text
Desktop: floating panel in bottom-right corner
Mobile: almost full-width panel above the bottom edge
```

No complicated animations are required.

---

## 21. Design direction

This is a functional prototype.

Use:

- white or light neutral background
- dark readable text
- simple green accent
- clear borders
- simple buttons
- product color swatches

Do NOT spend time on:

- elaborate hero art
- parallax
- video backgrounds
- advanced GSAP animation
- complex sliders
- production photography
- pixel-perfect luxury design

The goal is for management to understand the AI concept immediately.

---

## 22. Suggested project structure

```text
/
├── api/
│   └── assistant.js
├── data/
│   └── marinades.js
├── src/
│   ├── js/
│   │   ├── main.js
│   │   ├── catalog.js
│   │   ├── chat.js
│   │   └── product-highlight.js
│   └── scss/
│       └── main.scss
├── index.html
├── catalog.html
├── dry.html
├── liquid.html
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

You may simplify this structure if there is a cleaner implementation, but do not introduce a framework.

---

## 23. Vite multi-page build

Configure Vite so all four HTML pages are included in the production build:

```text
index.html
catalog.html
dry.html
liquid.html
```

Verify that all navigation works after `npm run build`.

Do not rely only on the development server.

---

## 24. Error handling

AI chat must handle these states:

- sending
- success
- API unavailable
- no matching product
- malformed AI response

User-facing fallback example:

```text
The AI assistant is temporarily unavailable. You can still browse the marinade catalog manually.
```

Do not expose technical stack traces or secret data in the browser.

---

## 25. Acceptance criteria

The task is complete only when all of the following work:

- [ ] Home page opens
- [ ] Home CTA opens catalog page
- [ ] Catalog page contains Dry and Liquid choices
- [ ] Dry choice opens `dry.html`
- [ ] Liquid choice opens `liquid.html`
- [ ] Dry page has exactly 10 products
- [ ] Liquid page has exactly 10 products
- [ ] Products use only yellow/red/green colors
- [ ] Products cover chicken/pork/fish
- [ ] Products have different flavor profiles
- [ ] AI chat opens on every page
- [ ] User can enter a natural-language request
- [ ] Frontend sends the request to `/api/assistant`
- [ ] AI only recommends IDs from the real catalog
- [ ] AI returns maximum 3 products
- [ ] Recommendations are clickable
- [ ] Clicking recommendation opens correct Dry/Liquid page
- [ ] Correct product card is automatically scrolled into view
- [ ] Correct product card is temporarily highlighted
- [ ] Unknown AI product IDs are rejected
- [ ] API key is never exposed in frontend code
- [ ] `.env` is ignored by Git
- [ ] Responsive layout works on mobile
- [ ] `npm run build` succeeds
- [ ] Browser console has no errors during the main demo flow

---

## 26. Priority

Priority order:

1. Working AI recommendation flow
2. Correct product matching
3. Click recommendation → exact product card
4. Simple catalog navigation
5. Responsive usability
6. Basic clean styling

Do not spend significant time polishing visuals before the full AI flow works.

---

## 27. Final Codex task

Implement this prototype completely.

Work pragmatically and keep the code simple.

Do not redesign or expand the scope.
Do not add extra pages, frameworks, authentication, database, admin panel, checkout, CRM, user accounts, or unrelated functionality.

Use the 20 demo marinades defined in this file as the only products.

First make the complete manual catalog flow work.
Then implement the AI assistant.
Then implement recommendation deep-linking and product highlighting.
Then run the production build and fix all errors.

At the end, report:

1. what files were created or changed
2. how to run locally
3. what environment variable is required
4. how to test the five demo AI conversations
5. how to deploy the demo without exposing the API key
