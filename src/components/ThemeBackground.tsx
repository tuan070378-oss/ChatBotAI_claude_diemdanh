import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ThemeBackgroundProps {
  isDarkMode: boolean;
}

export const ThemeBackground: React.FC<ThemeBackgroundProps> = ({ isDarkMode }) => {
  // Generate random stars for the background
  const stars = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
  }, []);

  // Generate falling stars (rain) for dark mode
  const fallingStars = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${30 + Math.random() * 40}%`, // Centered around the cloud
      delay: Math.random() * 10,
      duration: Math.random() * 4 + 4,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-1000">
      {/* Background Gradients */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          isDarkMode ? "opacity-0" : "opacity-100 bg-gradient-to-b from-blue-200 to-white"
        )} 
      />
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-1000 bg-[#030712] overflow-hidden",
          isDarkMode ? "opacity-100 animate-in fade-in duration-1000" : "opacity-0"
        )} 
      >
        {/* Glowing Cosmic Aurora Blobs */}
        <div className="absolute top-[-5%] left-[10%] w-[450px] h-[450px] rounded-full aurora-blur-1 opacity-35 animate-aurora-1" />
        <div className="absolute bottom-[5%] right-[5%] w-[500px] h-[500px] rounded-full aurora-blur-2 opacity-30 animate-aurora-2" />
        <div className="absolute top-[45%] left-[25%] w-[350px] h-[350px] bg-indigo-500/15 rounded-full blur-[100px] animate-pulse" />
      </div>

      {/* Sun / Moon Morph */}
      <div className="absolute top-20 right-20 w-32 h-32 flex items-center justify-center">
        <motion.div
          animate={{
            rotate: isDarkMode ? 360 : 0,
            scale: isDarkMode ? 0.8 : 1,
          }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="relative w-full h-full"
        >
          {/* Sun */}
          <motion.div
            animate={{ opacity: isDarkMode ? 0 : 1 }}
            className="absolute inset-0 bg-yellow-400 rounded-full shadow-[0_0_50px_rgba(250,204,21,0.6)]"
          />
          
          {/* Moon */}
          <motion.div
            animate={{ 
              opacity: isDarkMode ? 1 : 0,
              rotate: isDarkMode ? -15 : 0
            }}
            className="absolute inset-0 flex items-center justify-center animate-swing"
          >
            <div className="w-full h-full bg-gray-200 rounded-full shadow-[inset_-15px_-5px_0_0_rgba(0,0,0,0.1)] relative overflow-hidden">
              {/* Moon Craters */}
              <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-gray-300 rounded-full opacity-50" />
              <div className="absolute bottom-1/3 right-1/4 w-6 h-6 bg-gray-300 rounded-full opacity-50" />
              {/* Crescent Mask */}
              <div className="absolute -top-4 -left-4 w-full h-full bg-blue-950 rounded-full" />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Static Twinkling Stars (Dark Mode) */}
      <AnimatePresence>
        {isDarkMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute bg-white rounded-full animate-twinkle"
                style={{
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  animationDelay: `${star.delay}s`,
                  animationDuration: `${star.duration}s`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central Cloud */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-40 animate-float">
        <motion.div
          animate={{
            backgroundColor: isDarkMode ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
            boxShadow: isDarkMode 
              ? "0 10px 30px rgba(0,0,0,0.5)" 
              : "0 10px 30px rgba(0,0,0,0.05)"
          }}
          className="relative w-full h-full rounded-full blur-[2px] transition-colors duration-1000"
        >
          {/* Cloud Bumps */}
          <div className={cn(
            "absolute -top-10 left-10 w-32 h-32 rounded-full transition-colors duration-1000",
            isDarkMode ? "bg-slate-800/80" : "bg-white/90"
          )} />
          <div className={cn(
            "absolute -top-16 left-32 w-40 h-40 rounded-full transition-colors duration-1000",
            isDarkMode ? "bg-slate-800/80" : "bg-white/90"
          )} />
          <div className={cn(
            "absolute -top-8 right-10 w-28 h-28 rounded-full transition-colors duration-1000",
            isDarkMode ? "bg-slate-800/80" : "bg-white/90"
          )} />
        </motion.div>

        {/* Falling Stars from Cloud (Dark Mode) */}
        <AnimatePresence>
          {isDarkMode && (
            <div className="absolute top-20 left-0 right-0 h-[100vh] overflow-hidden">
              {fallingStars.map((star) => (
                <div
                  key={star.id}
                  className="absolute w-1 h-1 bg-blue-200 rounded-full blur-[1px]"
                  style={{
                    left: star.left,
                    animation: `fall ${star.duration}s linear infinite`,
                    animationDelay: `${star.delay}s`,
                  }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Drifting Clouds (Light Mode) */}
      <AnimatePresence>
        {!isDarkMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <div className="absolute top-[15%] left-[-10%] w-40 h-20 bg-white/40 rounded-full blur-xl animate-[drift_40s_linear_infinite]" />
            <div className="absolute top-[60%] left-[-20%] w-60 h-30 bg-white/30 rounded-full blur-2xl animate-[drift_60s_linear_infinite_reverse]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
