import './App.css'
// import { Play } from 'lucide-react'
import { FaPlay } from "react-icons/fa";
import { useState } from 'react';

function App() {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 to-black">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        {/* Glitch Play Button */}
        <div 
          className={`absolute transition-all duration-1000 ${
            isClicked ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
          }`}
          onClick={handleClick}
        >
          <div className="relative group cursor-pointer">
            {/* Red layer (top-left offset) */}
            <div className="absolute inset-0 transform -translate-x-1 -translate-y-1">
              <FaPlay size={400} className="text-red-500 opacity-80" />
            </div>
            
            {/* Blue layer (bottom-right offset) */}
            <div className="absolute inset-0 transform translate-x-1 translate-y-1">
              <FaPlay size={400} className="text-blue-500 opacity-80" />
            </div>
            
            {/* Green layer (center) */}
            <div className="relative">
              <FaPlay size={400} className="text-green-100" />
            </div>
          </div>
        </div>

        {/* COMING SOON Text - Centered */}
        <div className={`absolute transition-all duration-1000 delay-1000 ${
          isClicked ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}>
          <div className="relative">
            {/* Red layer (top-left offset) */}
            <div className="absolute inset-0 transform -translate-x-1 -translate-y-1">
              <h1 className="text-7xl font-bold text-red-500 opacity-80 tracking-wider">COMING <br /> SOON</h1>
            </div>
            
            {/* Blue layer (bottom-right offset) */}
            <div className="absolute inset-0 transform translate-x-1 translate-y-1">
              <h1 className="text-7xl font-bold text-blue-500 opacity-80 tracking-wider">COMING <br /> SOON</h1>
            </div>
            
            {/* Green layer (center) */}
            <div className="relative">
              <h1 className="text-7xl font-bold text-green-400 tracking-wider">COMING <br /> SOON</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Animated glitch effect overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-5 animate-pulse" style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 0, 0, 0.1) 50%, transparent 70%)',
          animation: 'glitch 3s infinite'
        }}></div>
      </div>
    </div>
  )
}

export default App
