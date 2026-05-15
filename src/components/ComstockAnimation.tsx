import { motion } from 'motion/react';

interface ComstockAnimationProps {
  scale: number;
  isActive: boolean;
}

export default function ComstockAnimation({ scale, isActive }: ComstockAnimationProps) {
  // scale 0: 0% waste (Empty plate) -> Habis total
  // scale 1: 25% waste (1/4 remaining)
  // scale 2: 50% waste (1/2 remaining)
  // scale 3: 75% waste (3/4 remaining)
  // scale 4: 95% waste (Small amount missing)
  // scale 5: 100% waste (Full plate)

  const getWastePercentage = (s: number) => {
    switch (s) {
      case 0: return 0;
      case 1: return 25;
      case 2: return 50;
      case 3: return 75;
      case 4: return 95;
      case 5: return 100;
      default: return 0;
    }
  };

  const percentage = getWastePercentage(scale);

  return (
    <div className="relative w-full aspect-square flex items-center justify-center p-4">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Shadow */}
        <circle cx="50" cy="55" r="40" fill="rgba(0,0,0,0.05)" />
        
        {/* Plate */}
        <circle cx="50" cy="50" r="40" fill="white" stroke="#e2e8f0" strokeWidth="1" />
        <circle cx="50" cy="50" r="32" fill="none" stroke="#f1f5f9" strokeWidth="1" />
        
        {/* Food Illustration (Represented by Rice or a composite shape) */}
        <motion.g
          initial={false}
          animate={{
            scale: isActive ? 1.05 : 1,
            opacity: percentage === 0 ? 0.2 : 1
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Base Food (The Full Amount) */}
          <path
            d="M 50 18 A 32 32 0 1 1 50 82 A 32 32 0 1 1 50 18 Z"
            fill="#f8fafc"
          />
          
          {/* Actual Food Content */}
          <motion.path
            d="M 50 50 L 50 18 A 32 32 0 1 1 50 82 A 32 32 0 1 1 50 18 Z"
            fill={isActive ? '#10b981' : '#ecfdf5'}
            initial={false}
            animate={{
              d: percentage === 0 
                ? "M 50 50 L 50 50 A 0 0 0 1 1 50 50 Z" 
                : percentage === 100
                ? "M 50 50 L 50 18 A 32 32 0 1 1 50 82 A 32 32 0 1 1 50 18 Z"
                : `M 50 50 L 50 18 A 32 32 0 ${percentage > 50 ? 1 : 0} 1 ${50 + 32 * Math.sin(2 * Math.PI * (percentage / 100))} ${50 - 32 * Math.cos(2 * Math.PI * (percentage / 100))} Z`
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          />

          {/* Decorative bits to make it look like food */}
          {percentage > 0 && (
            <motion.g
              animate={{ opacity: percentage > 0 ? 1 : 0 }}
            >
              <circle cx="45" cy="45" r="2" fill="#fff" opacity="0.6" />
              <circle cx="55" cy="40" r="1.5" fill="#fff" opacity="0.4" />
              <circle cx="40" cy="55" r="2.5" fill="#fff" opacity="0.5" />
            </motion.g>
          )}
        </motion.g>
        
        {/* Fork and Spoon accents */}
        <g stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
          {/* Spoon */}
          <path d="M 15 30 Q 10 35 15 40 L 5 70" fill="none" />
          {/* Fork */}
          <path d="M 85 30 L 85 40 M 82 30 L 82 40 M 88 30 L 88 40 M 85 40 L 95 70" fill="none" />
        </g>
      </svg>
      
      {/* Percentage Overlay */}
      <motion.div 
        className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
        animate={{ scale: isActive ? 1.2 : 1 }}
      >
        <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {percentage}%
        </div>
      </motion.div>
    </div>
  );
}
