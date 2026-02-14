"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import celebrationGif from "@/assets/celebration.gif";
import Matter from "matter-js";

const HEART_EMOJIS = ["❤️", "💕", "💖", "💗", "💘", "💝", "🥰", "😍", "💞", "💓"];
const TOTAL_HEARTS = 80;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsMobile(check);
  }, []);
  return isMobile;
}

// ─── Desktop: simple falling emojis ───
function SimpleFloatingHearts() {
  const hearts = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
        left: Math.random() * 100,
        size: Math.random() * 16 + 14,
        duration: Math.random() * 6 + 6,
        delay: Math.random() * 10,
        swingAmount: Math.random() * 50 - 25,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          style={{
            position: "absolute",
            left: `${heart.left}%`,
            top: -40,
            fontSize: heart.size,
          }}
          animate={{
            y: ["0vh", "110vh"],
            x: [0, heart.swingAmount, -heart.swingAmount, 0],
            rotate: [0, 360],
          }}
          transition={{
            y: { duration: heart.duration, repeat: Infinity, delay: heart.delay, ease: "linear" },
            x: { duration: heart.duration / 2, repeat: Infinity, delay: heart.delay, ease: "easeInOut" },
            rotate: { duration: heart.duration * 2, repeat: Infinity, delay: heart.delay, ease: "linear" },
          }}
        >
          {heart.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Mobile: physics-based with collisions ───
interface HeartState {
  id: number;
  emoji: string;
  x: number;
  y: number;
  angle: number;
  size: number;
}

function PhysicsHearts() {
  const [hearts, setHearts] = useState<HeartState[]>([]);
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodiesRef = useRef<{ body: Matter.Body; emoji: string; size: number }[]>([]);
  const spawnedRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.002 } });
    engineRef.current = engine;

    const wallThickness = 60;
    const floor = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true });
    const ceiling = Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true });
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
    Matter.Composite.add(engine.world, [floor, ceiling, leftWall, rightWall]);

    // Request motion permission on iOS
    const requestMotionPermission = async () => {
      const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof doe.requestPermission === "function") {
        try { await doe.requestPermission(); } catch {}
      }
      const dme = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof dme.requestPermission === "function") {
        try { await dme.requestPermission(); } catch {}
      }
    };
    requestMotionPermission();

    // Device orientation: tilt changes gravity
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!engineRef.current) return;
      if (e.beta === null && e.gamma === null) return;
      const gamma = (e.gamma ?? 0) / 90;
      const beta = Math.min(Math.max((e.beta ?? 90), -90), 90) / 90;
      engineRef.current.gravity.x = gamma;
      engineRef.current.gravity.y = Math.max(beta, 0.3);
    };
    window.addEventListener("deviceorientation", handleOrientation);

    // Device motion: shake = snow globe
    let lastShakeTime = 0;
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const force = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const now = Date.now();
      if (force > 25 && now - lastShakeTime > 300) {
        lastShakeTime = now;
        bodiesRef.current.forEach(({ body }) => {
          Matter.Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 15,
            y: -(Math.random() * 10 + 5),
          });
        });
      }
    };
    window.addEventListener("devicemotion", handleMotion);

    // Spawn hearts
    const spawnInterval = setInterval(() => {
      if (spawnedRef.current >= TOTAL_HEARTS) {
        clearInterval(spawnInterval);
        return;
      }
      const size = Math.random() * 14 + 18;
      const body = Matter.Bodies.circle(
        Math.random() * (width - 60) + 30,
        -30 - Math.random() * 200,
        size / 2,
        { restitution: 0.4, friction: 0.3, density: 0.002, frictionAir: 0.01 }
      );
      Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 3, y: 0 });
      bodiesRef.current.push({
        body,
        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
        size,
      });
      Matter.Composite.add(engine.world, body);
      spawnedRef.current++;
    }, 100);

    // Physics loop
    let lastTime = performance.now();
    const update = (time: number) => {
      const delta = Math.min(time - lastTime, 30);
      lastTime = time;
      Matter.Engine.update(engine, delta);
      const newHearts: HeartState[] = bodiesRef.current.map((h, i) => ({
        id: i,
        emoji: h.emoji,
        x: h.body.position.x,
        y: h.body.position.y,
        angle: h.body.angle,
        size: h.size,
      }));
      setHearts(newHearts);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);

    return () => {
      clearInterval(spawnInterval);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
      Matter.Engine.clear(engine);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          style={{
            position: "absolute",
            left: heart.x,
            top: heart.y,
            fontSize: heart.size,
            transform: `translate(-50%, -50%) rotate(${heart.angle}rad)`,
            willChange: "transform",
          }}
        >
          {heart.emoji}
        </div>
      ))}
    </div>
  );
}

// ─── Wrapper: picks the right component ───
function FallingHearts() {
  const isMobile = useIsMobile();
  return isMobile ? <PhysicsHearts /> : <SimpleFloatingHearts />;
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
