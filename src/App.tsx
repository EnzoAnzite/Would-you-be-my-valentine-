"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import celebrationGif from "@/assets/celebration.gif";
import Matter from "matter-js";

const HEART_EMOJIS = ["❤️", "💕", "💖", "💗", "💘", "💝", "🥰", "😍", "💞", "💓"];
const TOTAL_HEARTS = 80;

// ─── Universal: physics-based with collisions ───
interface HeartState {
  id: number;
  emoji: string;
  x: number;
  y: number;
  angle: number;
  size: number;
}

function FallingHearts() {
  const [hearts, setHearts] = useState<HeartState[]>([]);
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodiesRef = useRef<{ id: number; body: Matter.Body; emoji: string; size: number }[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Setup Matter.js Engine
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.005 }, // Adjusted gravity for mobile feel
      enableSleeping: false // IMPORTANT: Prevent bodies from freezing
    });
    engineRef.current = engine;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 2. Create Walls
    const wallThickness = 1000; // Very thick walls to prevent tunneling
    // Raised floor by 5px (-10 -> -15)
    const floor = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2 - 35, width * 2, wallThickness, { isStatic: true, label: "Floor" });
    const ceiling = Matter.Bodies.rectangle(width / 2, -wallThickness / 2 - 1000, width * 2, wallThickness, { isStatic: true, label: "Ceiling" }); // High ceiling
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2 - 10, height / 2, wallThickness, height * 5, { isStatic: true, label: "Left Wall" });
    const rightWall = Matter.Bodies.rectangle(width + wallThickness / 2 + 10, height / 2, wallThickness, height * 5, { isStatic: true, label: "Right Wall" });

    Matter.Composite.add(engine.world, [floor, ceiling, leftWall, rightWall]);

    // 3. Spawn Hearts
    let spawnedCount = 0;
    const spawnInterval = setInterval(() => {
      if (spawnedCount >= TOTAL_HEARTS) {
        clearInterval(spawnInterval);
        return;
      }

      const size = Math.random() * 20 + 20; // Size 20-40px
      const xPos = Math.random() * (width - 40) + 20;
      const yPos = -50 - Math.random() * 200; // Start above screen

      const body = Matter.Bodies.circle(xPos, yPos, size / 2.2, { // Hitbox slightly smaller than emoji
        restitution: 0.5, // Bounciness
        friction: 0.5,    // Friction against other bodies
        density: 0.05,    // Mass
        frictionAir: 0.01,// Air resistance
        isStatic: false,
        label: "Heart"
      });

      // Give random initial spin and velocity
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
      Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: 5 + Math.random() * 5 });

      Matter.Composite.add(engine.world, body);

      bodiesRef.current.push({
        id: spawnedCount,
        body,
        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
        size,
      });

      spawnedCount++;
    }, 50); // Spawn faster (every 50ms)

    // 4. Input Handlers (Device Motion & Orientation)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!engineRef.current) return;
      const gamma = (e.gamma ?? 0) / 90; // Tilt L/R (-1 to 1)
      const beta = Math.min(Math.max((e.beta ?? 90), -90), 90) / 90; // Tilt F/B (-1 to 1)
      
      // Update gravity direction
      engineRef.current.gravity.x = gamma * 1.5;
      engineRef.current.gravity.y = Math.max(beta, 0.2) * 1.5; // Always keep some downward pull
    };

    let lastShake = 0;
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const force = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      
      if (force > 20 && Date.now() - lastShake > 300) { // Shake threshold
        lastShake = Date.now();
        // Snow globe effect: Apply upward/random force to all hearts
        bodiesRef.current.forEach(({ body }) => {
          Matter.Body.applyForce(body, body.position, {
            x: (Math.random() - 0.5) * 0.05 * body.mass,
            y: -0.05 * body.mass - Math.random() * 0.02 * body.mass // Upward kick
          });
        });
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);

    // Request permissions (iOS)
    (async () => {
        const doe = DeviceOrientationEvent as any;
        if (typeof doe.requestPermission === 'function') {
            try { await doe.requestPermission(); } catch {}
        }
        const dme = DeviceMotionEvent as any;
        if (typeof dme.requestPermission === 'function') {
            try { await dme.requestPermission(); } catch {}
        }
    })();


    // 5. Runner & Render Loop
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    let rafId = 0;
    const render = () => {
      // Sync React state with Matter.js positions
      setHearts(bodiesRef.current.map(h => ({
        id: h.id,
        emoji: h.emoji,
        x: h.body.position.x,
        y: h.body.position.y,
        angle: h.body.angle,
        size: h.size
      })));
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    // 6. Cleanup
    return () => {
      clearInterval(spawnInterval);
      cancelAnimationFrame(rafId);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, []);

  return (
    <div ref={sceneRef} className="fixed inset-0 pointer-events-none overflow-hidden z-0 touch-none">
       {/* DEBUG: Remove this later if visible */}
       {/* <div className="absolute top-0 left-0 bg-black/50 text-white text-xs p-1 z-50">
          Hearts: {hearts.length}
       </div> */}

      {hearts.map((heart) => (
        <div
          key={heart.id}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${heart.x}px, ${heart.y}px) rotate(${heart.angle}rad) translate(-50%, -50%)`,
            fontSize: `${heart.size}px`,
            lineHeight: 1,
            userSelect: "none",
            willChange: "transform"
          }}
        >
          {heart.emoji}
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const [noCount, setNoCount] = useState(0);
  const [yesPressed, setYesPressed] = useState(false);
  const yesButtonSize = noCount * 20 + 16;

  const handleNoClick = () => {
    setNoCount(noCount + 1);
  };

  const getNoButtonText = () => {
    const phrases = [
      "Non",
      "t'es sur ?",
      "Et si je demandais vraiment gentillement?",
      "Tefou tu me fais laquelle ?",
      "même pour un crousty ?",
      "Et si je rajoutais des Rafaello ?",
      "Mais..",
      "Je vais vraiment mourir",
      "mbi kui",
      "Tu parle à mon fantôme ",
      "Tiff..",
      "Triple T !!",
      "Mannequin jolie bebe de mon coeur",
      "Non :(",
    ];

    const index = Math.min(noCount, phrases.length - 1);
    return phrases[index];
  };

  return (
    <motion.div 
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-red-50 p-4 overflow-hidden"
      animate={{ x: noCount > 0 ? [-5 * noCount, 5 * noCount, -5 * noCount, 0] : 0 }}
      transition={{ duration: 0.2 }}
    >
      {yesPressed && <FallingHearts />}
      <AnimatePresence mode="wait">
      {yesPressed ? (
        <motion.div
          className="z-10 relative"
          key="yes-card"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <Card className="mx-4 max-w-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-100 to-red-100 shadow-2xl">
            <CardContent className="flex flex-col items-center gap-4 p-4 sm:gap-6 sm:p-8">
              <motion.img 
                src={celebrationGif}
                alt="celebration"
                className="h-40 w-50 sm:h-64 sm:w-64 rounded-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, type: "spring" }}
              />
              <motion.h2 
                className="text-center text-xl sm:text-2xl md:text-4xl font-bold text-pink-600"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Je savais que t'allais dire oui de toute façon !
                <br />
                <br />
                Donc rdv à 20h30 avant d'aller{" "}
                <motion.span
                  style={{ display: "inline-block" }}
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  douxtcha douxtchatcha !!!
                </motion.span>{" "}

              </motion.h2>
              <motion.p 
                className="text-center text-lg sm:text-xl md:text-3xl font-bold text-pink-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                Soit en retard seulement !!
              </motion.p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="question"
          className="flex flex-col items-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <motion.img
            className="mb-4 sm:mb-8 h-48 sm:h-64 rounded-lg object-cover"
            src="https://gifdb.com/images/high/cute-love-bear-roses-ou7zho5oosxnpo6k.gif"
            alt="romantic bear"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            whileHover={{ scale: 1.05 }}
          />
          <motion.h1 
            className="mb-4 sm:mb-8 text-center text-2xl sm:text-3xl md:text-4xl font-bold text-pink-600 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Will you be my Valentine?
          </motion.h1>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-4">
            <motion.button
              className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700"
              style={{ fontSize: yesButtonSize }}
              onClick={() => setYesPressed(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: ["0px 0px 0px rgba(34, 197, 94, 0)", "0px 0px 20px rgba(34, 197, 94, 0.8)", "0px 0px 0px rgba(34, 197, 94, 0)"] }}
              transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
            >
              Oui
            </motion.button>
            {noCount < 14 && (
              <motion.button
                key={noCount}
                onClick={handleNoClick}
                className="flex-shrink-0 rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{ x: [0, -10 * noCount, 10 * noCount, -10 * noCount, 0] }}
                transition={{ duration: 0.2 }}
              >
                {noCount === 0 ? "Non" : getNoButtonText()}
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
