# SimVerse 🌌

An interactive physics simulation playground powered by AI. Sketch regions and forces, then watch the simulation respond to your natural language commands using Google's Gemini AI.

## Features

### 🎨 Interactive Canvas
- **Real-time 2D Physics** - Matter.js-powered physics engine with gravity, friction, restitution, and wind forces
- **Sketch Annotations** - Draw regions and force vectors directly on the canvas
- **Floating Lines Background** - Beautiful WebGL-rendered animated background using Three.js
- **Smooth Interaction** - Play mode to observe, Region/Arrow to sketch, Delete to clear

### 🤖 AI-Powered Commands
- **Natural Language Processing** - Describe what you want in plain English
- **Dual Mode Support**:
  - **Direct Mode**: Uses real Google Gemini 3 API for intelligent responses
  - **Mock Mode**: Simulated responses for demos and testing (no API key required)
- **Smart Action Execution** - AI translates commands into physics parameter changes and force field modifications

### ⚙️ Customizable Physics
- **Gravity Y** - Control downward acceleration (0-0.8)
- **Air Friction** - Dampen motion over time (0-0.06)
- **Restitution** - Bounce energy (0-1.0)
- **Wind Strength** - Apply directional forces (0-1.0)
- **Preset Configurations** - Quick-apply tested physics states

### 🎯 Demo Buttons
Quick-start commands for common scenarios:
- **Swirl + Stabilize** - Creates swirling motion then dampens it
- **Drift Right** - Applies rightward wind force
- **Chaos + Spawn** - Creates chaotic motion with 10 new balls
- **Calm Reset** - Returns to a peaceful, stable state

### 📊 Live Statistics
- Real-time ball count, sketch count, and force field count
- Current AI mode indicator (Direct/Mock)
- Performance monitoring

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- (Optional) Google Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Installation

```bash
git clone <repository-url>
cd simverse
npm install
```

### Configuration

#### Option 1: Use Mock Mode (No Setup Required)
1. Start the dev server: `npm run dev`
2. Toggle to **Mock Mode** in the Status section
3. Start experimenting!

#### Option 2: Use Direct Mode (Requires API Key)
1. Get your Gemini 3 API key from [Google AI Studio](https://aistudio.google.com)
2. Create `.env.local` in the project root:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
3. Start the dev server: `npm run dev`
4. Ensure Status shows **Direct Mode**
5. Paste your API key in the "API Key" section at the bottom of the sidebar

### Running

**Development:**
```bash
npm run dev
```
Opens at `http://localhost:5173`

**Build for Production:**
```bash
npm run build
npm run preview
```

## How to Use

### Basic Workflow
1. **Observe** (Play mode) - Watch the simulation
2. **Sketch** (Region/Arrow modes):
   - **Draw Region**: Click and drag to create a circular region
   - **Draw Arrow**: Click and drag to create a directional force
3. **Command** - Describe what you want:
   - "Create a swirling motion inside the region"
   - "Apply rightward wind"
   - "Stabilize the motion"
4. **See Results** - Watch the AI adjust physics parameters and apply forces

### Controls
- **Play** - Observation mode (no sketching)
- **Draw Region** - Create circular regions (click-drag)
- **Draw Arrow** - Create force vectors (click-drag)
- **Delete** - Remove annotations (click to select)
- **Spawn 10** - Add 10 new balls
- **Reset** - Return to default physics state
- **Clear Forces** - Remove all force fields
- **Clear Annotations** - Remove all sketches

### AI Modes

#### Direct Mode ✨
- Real Gemini 3 API responses
- Intelligent, context-aware behavior
- Requires API key
- Subject to rate limits

#### Mock Mode 🎭
- Simulated responses with pattern matching
- Works instantly without API key
- Perfect for demos and testing
- Great for understanding command intent

Toggle between modes anytime using the **Switch** button in the Status section.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **Three.js** - WebGL rendering for animated background

### Physics & Simulation
- **Matter.js** - 2D rigid body physics engine
- **Canvas 2D API** - Real-time rendering

### AI Integration
- **Google Gemini 3 API** - Natural language processing
- **Custom Adapter** - API abstraction layer

### Desktop (Electron)
- **Electron** - Cross-platform desktop app
- **electron-builder** - App packaging and distribution

## Project Structure

```
simverse/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── FloatingLines.tsx        # WebGL background component
│   ├── ai/
│   │   ├── adapter.ts          # Gemini API integration
│   │   ├── execute.ts          # AI action executor
│   │   ├── mockGemini.ts       # Simulated responses
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── validate.ts         # Response validation
│   ├── controls/
│   │   ├── SimController.ts    # Physics simulation controller
│   │   └── presets.ts          # Physics preset configurations
│   ├── engine/
│   │   ├── createWorld.ts      # Matter.js world setup
│   │   └── stepWorld.ts        # Physics step function
│   ├── models/
│   │   ├── Annotation.ts       # Region/Force data types
│   │   ├── ForceField.ts       # Force field implementation
│   │   └── Params.ts           # Physics parameters
│   ├── render/
│   │   ├── drawOverlay.ts      # Canvas annotations
│   │   ├── drawWorld.ts        # Main render loop
│   │   └── resizeCanvas.ts     # Responsive canvas
│   ├── utils/
│   │   └── id.ts               # ID generation
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── electron/
│   ├── main.ts                 # Electron main process
│   └── preload.ts              # Electron preload script
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.json5
```

## Environment Variables

Create `.env.local` (not committed to git):
```
VITE_GEMINI_API_KEY=your_api_key_here
```

⚠️ **Never commit `.env.local`** - It contains sensitive API credentials. Always use `.gitignore` to exclude it.

## Available Scripts

- `npm run dev` - Start dev server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run electron-dev` - Run Electron dev mode
- `npm run electron-build` - Package Electron app

## AI Model Information

Currently uses **Google Gemini 3 API** for:
- Natural language command interpretation
- Physics simulation recommendations
- Parameter optimization suggestions

The AI can understand commands like:
- "Create a swirling motion"
- "Make it more chaotic"
- "Stabilize everything"
- "Apply wind to the right"

## Limitations & Known Issues

- Gemini API 503 errors during high traffic - fallback to Mock Mode
- WebGL background requires WebGL 2.0 support
- Physics simulation bounded to canvas dimensions
- Maximum ~100 balls recommended for smooth performance

## Future Enhancements

- [ ] 3D physics simulation
- [ ] Save/load simulation states
- [ ] Multiplayer collaboration
- [ ] Custom physics presets library
- [ ] Advanced AI prompt engineering UI
- [ ] Mobile touch support
- [ ] WebAssembly physics engine for better performance

## Contributing

This project was created for a hackathon. Contributions and improvements are welcome!

## License

Open source - feel free to use, modify, and distribute.

## Credits

- **Physics Engine**: Matter.js community
- **AI Model**: Google Gemini
- **Graphics**: Three.js and Canvas 2D
- **Framework**: React & Vite team

---

Made with ❤️ for physics simulation and AI exploration.
