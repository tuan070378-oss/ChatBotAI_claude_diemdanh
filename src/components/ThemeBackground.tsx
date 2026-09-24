import React from 'react';
import { cn } from '../lib/utils';

interface ThemeBackgroundProps {
  isDarkMode: boolean;
}

/**
 * Nền "Cơ khí Lửa": lưới kỹ thuật (bản vẽ kỹ thuật) + glow lửa nhẹ ở góc trên.
 * Giữ nguyên interface (isDarkMode) để ChatInterface.tsx không cần đổi cách gọi.
 * Không dùng animation nặng — chỉ 1 lớp gradient tĩnh + lưới CSS thuần, rất nhẹ.
 */
export const ThemeBackground: React.FC<ThemeBackgroundProps> = ({ isDarkMode }) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-700">
      {/* Nền sáng: linear-gradient(180deg, #A3E0FF 0%, #5FB1ED 100%) */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          isDarkMode ? "opacity-0" : "opacity-100"
        )}
        style={{
          background: "linear-gradient(180deg, #A3E0FF 0%, #5FB1ED 100%)"
        }}
      />

      {/* Nền tối: navy + lưới kỹ thuật + glow lửa góc trên */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 bg-navy technical-grid-bg",
          isDarkMode ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(255,107,26,0.10), transparent)"
          }}
        />
      </div>
    </div>
  );
};