import { GoogleGenerativeAI } from "@google/generative-ai";
import { SubscriptionPlan } from "../models/user.model";

export interface ManimCodeRequest {
  prompt: string;
  complexity: "basic" | "intermediate" | "advanced";
  userPlan: SubscriptionPlan;
}

export interface ManimCodeResponse {
  success: boolean;
  code: string;
  description: string;
  complexity: string;
  estimatedDuration: number;
  error?: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required");
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async generateManimCode(
    request: ManimCodeRequest
  ): Promise<ManimCodeResponse> {
    const { prompt, complexity, userPlan } = request;

    try {
      // Build system prompt based on complexity and user plan
      const systemPrompt = this.buildSystemPrompt(complexity, userPlan);
      const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}\n\nGenerate the Manim animation code:`;

      console.log("🤖 Generating Manim code with Gemini...");

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const generatedText = response.text();

      // Parse the response to extract code and metadata
      const parsed = this.parseGeminiResponse(generatedText);

      return {
        success: true,
        code: parsed.code,
        description: parsed.description,
        complexity,
        estimatedDuration: parsed.estimatedDuration,
      };
    } catch (error) {
      console.error("❌ Gemini API Error:", error);
      return {
        success: false,
        code: "",
        description: "",
        complexity,
        estimatedDuration: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Manim code",
      };
    }
  }

  private buildSystemPrompt(
    complexity: string,
    userPlan: SubscriptionPlan
  ): string {
    const basePrompt = `You are a Manim (Mathematical Animation Engine) expert. Generate clean, executable Manim Community Edition code that creates educational mathematical animations.

CRITICAL REQUIREMENTS:
- Use only Manim Community Edition syntax (from manim import *)
- Create a Scene class that inherits from Scene
- Use construct() method for the animation
- Include proper imports and class structure
- Make animations educational and visually clear
- Add comments explaining key steps
- Ensure code is production-ready and error-free

RESPONSE FORMAT:
1. Brief description of the animation (2-3 sentences)
2. Python code block wrapped in \`\`\`python and \`\`\`
3. Estimated duration in seconds

TECHNICAL CONSTRAINTS:`;

    const complexityInstructions = {
      basic: `
- Keep animations simple (3-5 objects max)
- Use basic shapes: Circle, Square, Rectangle, Text, NumberLine
- Simple transformations: FadeIn, FadeOut, Transform
- Duration: 5-15 seconds
- Focus on single concept visualization`,

      intermediate: `
- Moderate complexity (5-10 objects)
- Mathematical objects: Axes, Graph, NumberPlane, MathTex
- Transformations: ReplacementTransform, Write, DrawBorderThenFill
- Duration: 15-30 seconds
- Can show step-by-step processes`,

      advanced: `
- Complex visualizations (10+ objects)
- Advanced features: ValueTracker, updater functions, 3D scenes
- Complex transformations: morphing, parametric animations
- Duration: 30-60 seconds
- Multi-step educational content`,
    };

    const planLimitations = {
      [SubscriptionPlan.BASIC]: `
- Maximum 30 seconds animation
- No 3D scenes
- Basic color schemes only`,
      [SubscriptionPlan.INTERMEDIATE]: `
- Maximum 60 seconds animation
- Can use 3D scenes
- Advanced color schemes and styling`,
      [SubscriptionPlan.ADVANCED]: `
- Maximum 120 seconds animation  
- Full 3D capabilities
- Custom styling and advanced features
- Can use plugins and external libraries`,
    };

    return `${basePrompt}\n\nCOMPLEXITY LEVEL: ${complexity.toUpperCase()}\n${complexityInstructions[complexity as keyof typeof complexityInstructions]}\n\nUSER PLAN LIMITATIONS: ${userPlan.toUpperCase()}\n${planLimitations[userPlan]}`;
  }

  private parseGeminiResponse(response: string): {
    code: string;
    description: string;
    estimatedDuration: number;
  } {
    try {
      // Extract description (usually the first meaningful paragraph)
      const lines = response.trim().split("\n");
      const description =
        lines.find(
          (line) =>
            line.trim().length > 20 &&
            !line.includes("```") &&
            !line.toLowerCase().includes("duration") &&
            !line.toLowerCase().includes("code") &&
            line.trim() !== ""
        ) || "Mathematical animation generated with Manim";

      // Extract code block between `````` (more robust)
      const codeMatches = [/``````/g, /``````/g, /``````/g];

      let code = "";
      for (const regex of codeMatches) {
        const match = response.match(regex);
        if (match && match[1]) {
          code = match[1].trim();
          break;
        }
      }

      // If no code block found, try to extract Python-like content
      if (!code) {
        const pythonLines = response
          .split("\n")
          .filter(
            (line) =>
              line.includes("class ") ||
              line.includes("def construct") ||
              line.includes("from manim") ||
              line.includes("import manim") ||
              line.includes("self.play") ||
              line.includes("self.add")
          );

        if (pythonLines.length > 0) {
          code = pythonLines.join("\n");
        } else {
          code = this.generateFallbackCode();
        }
      }

      // Clean and validate the code
      code = this.cleanManimCode(code);

      // Extract estimated duration (multiple patterns)
      const durationPatterns = [
        /(?:duration|time):\s*(\d+)/i,
        /(\d+)\s*seconds?/i,
        /takes?\s*(\d+)/i,
      ];

      let estimatedDuration = 10; // default
      for (const pattern of durationPatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          const duration = parseInt(match[1]);
          if (duration > 0 && duration <= 300) {
            // reasonable bounds
            estimatedDuration = duration;
            break;
          }
        }
      }

      return {
        code: code || this.generateFallbackCode(),
        description: description
          .replace(/^[^\w]*/, "")
          .substring(0, 200)
          .trim(),
        estimatedDuration,
      };
    } catch (error) {
      console.error("Error parsing Gemini response:", error);
      return {
        code: this.generateFallbackCode(),
        description: "Error parsing AI response, using fallback animation",
        estimatedDuration: 10,
      };
    }
  }

  private cleanManimCode(code: string): string {
    // Ensure proper imports
    if (!code.includes("from manim import")) {
      code = "from manim import *\n\n" + code;
    }

    // Ensure proper class structure
    if (!code.includes("class ") || !code.includes("Scene")) {
      const codeLines = code
        .split("\n")
        .filter(
          (line) =>
            !line.includes("from manim") &&
            !line.includes("import") &&
            line.trim() !== ""
        );

      code = `from manim import *

class GeneratedAnimation(Scene):
    def construct(self):
${codeLines.map((line) => "        " + line).join("\n")}`;
    }

    // Fix common indentation issues
    code = this.fixIndentation(code);

    return code;
  }

  private fixIndentation(code: string): string {
    const lines = code.split("\n");
    const fixedLines: string[] = [];
    let inClass = false;
    let inMethod = false;

    for (const line of lines) {
      if (line.includes("class ") && line.includes("Scene")) {
        fixedLines.push(line);
        inClass = true;
      } else if (line.includes("def construct(self):")) {
        fixedLines.push("    " + line.trim());
        inMethod = true;
      } else if (inMethod && line.trim()) {
        // Ensure proper indentation for method content
        if (!line.startsWith("        ") && !line.startsWith("    def")) {
          fixedLines.push("        " + line.trim());
        } else {
          fixedLines.push(line);
        }
      } else {
        fixedLines.push(line);
      }
    }

    return fixedLines.join("\n");
  }

  private generateFallbackCode(): string {
    return `from manim import *

class GeneratedAnimation(Scene):
    def construct(self):
        # Basic animation fallback
        text = Text("Generated Animation")
        self.play(Write(text))
        self.wait(2)
        
        circle = Circle(radius=1, color=BLUE)
        self.play(Create(circle))
        self.wait(1)
        
        self.play(FadeOut(text), FadeOut(circle))`;
  }
}
