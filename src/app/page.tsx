'use client';

import { useEffect, useState } from 'react';
import CustomCursor from '@/components/CustomCursor';
import Loader from '@/components/Loader';
import TransferCard from '@/components/TransferCard';

export default function Home() {
  const [navBgOpacity, setNavBgOpacity] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setNavBgOpacity(1);
      } else {
        setNavBgOpacity(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="antialiased selection:bg-wine-900 selection:text-white">
      <CustomCursor />
      <Loader />

      {/* Background */}
      <div className="aurora-bg"></div>

      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-500" id="navbar">
        <div
          className="absolute inset-0 backdrop-blur-sm transition-all duration-500 border-b border-transparent"
          style={{
            backgroundColor: navBgOpacity > 0 ? 'rgba(2, 0, 5, 0.8)' : 'transparent',
            borderColor: navBgOpacity > 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
          }}
        ></div>
        <div className="max-w-7xl mx-auto px-8 py-8 flex justify-between items-center relative">
          {/* Logo with Animated Swiss Cross */}
          <div className="text-xl font-bold tracking-[0.3em] serif text-white z-10 flex items-center gap-4 logo-container cursor-pointer">
            <div className="swiss-cross-icon"></div>
            ZURIX
          </div>
          
          <div className="hidden md:flex space-x-8 text-[11px] tracking-[0.2em] font-medium uppercase z-10">
            <a 
              href="#services" 
              className="text-gray-400 hover:text-white transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById('services');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              Privileges
            </a>
            <a 
              href="#vault" 
              className="text-gray-400 hover:text-white transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById('vault');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              The Vault
            </a>
            <a 
              href="#heritage" 
              className="text-gray-400 hover:text-white transition-colors duration-300"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById('heritage');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              Legacy
            </a>
            <a
              href="https://github.com/ZurixApp/Zurix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-300"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Content: Philosophy */}
          <div
            className="lg:col-span-7 space-y-10 z-10 opacity-0 translate-y-10 animate-fade-up"
            style={{ animationDelay: '1.5s', animationFillMode: 'forwards' }}
          >
            <div className="inline-flex items-center space-x-3">
              <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-wine-500"></span>
              <span className="text-[10px] tracking-[0.4em] text-wine-500 uppercase">Private Banking Redefined</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl leading-[0.95] font-light tracking-wide">
              <span className="block text-white">SILENCE</span>
              <span className="block font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-wine-500 via-white to-wine-500 pb-2">
                IS LUXURY.
              </span>
            </h1>
            
            <p className="text-gray-400 text-sm md:text-base max-w-md leading-8 font-light border-l border-white/10 pl-6">
              We provide the invisibility cloak for your capital. Swiss sovereignty meets cryptographic security on Solana.
            </p>
            
            <div className="pt-8 flex gap-6">
              <a href="/docs" className="group relative px-10 py-5 overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md transition-all hover:border-wine-500/40">
                <span className="relative z-10 text-[10px] tracking-[0.3em] uppercase group-hover:text-white transition-colors">
                  Documentation
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-wine-900/40 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
              </a>
              <a 
                href="https://x.com/zurixapp" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative px-10 py-5 overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md transition-all hover:border-wine-500/40"
              >
                <span className="relative z-10 text-[10px] tracking-[0.3em] uppercase group-hover:text-white transition-colors">
                  <i className="fa-brands fa-x-twitter"></i> Follow
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-wine-900/40 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
              </a>
            </div>
          </div>

          {/* Right Content: Interactive Transfer Card */}
          <TransferCard />
        </div>
      </section>

      {/* Marquee */}
      <div className="py-4 border-y border-white/5 bg-black/20 backdrop-blur-md relative z-20">
        <div className="flex whitespace-nowrap animate-[scroll_40s_linear_infinite] overflow-hidden">
          <div className="flex gap-24 animate-marquee">
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Zurich HQ <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Solana Mainnet <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Offshore Arbitrage <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Geneva Vaults <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Zurich HQ <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Solana Mainnet <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Offshore Arbitrage <span className="text-wine-500 mx-2">●</span>
            </span>
            <span className="text-xs tracking-[0.3em] text-gray-500 uppercase">
              Geneva Vaults <span className="text-wine-500 mx-2">●</span>
            </span>
          </div>
        </div>
      </div>

      {/* Services */}
      <section id="services" className="py-40 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center mb-32 space-y-4">
            <span className="text-wine-500 text-xs tracking-[0.3em]">THE PRIVILEGES</span>
            <h2 className="text-4xl md:text-5xl font-serif text-center text-white">CURATED SOVEREIGNTY</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Card 1 */}
            <div className="luxury-card p-12 group">
              <div className="corner-accent tl"></div>
              <div className="corner-accent tr"></div>
              <div className="corner-accent bl"></div>
              <div className="corner-accent br"></div>
              
              <div className="h-16 w-16 mb-10 flex items-center justify-center border border-white/10 rounded-full group-hover:border-wine-500/50 transition-colors duration-500">
                <i className="fas fa-user-secret text-2xl text-white group-hover:text-wine-500 transition-colors"></i>
              </div>
              
              <h3 className="text-xl text-white tracking-[0.1em] mb-6 font-light serif">PRIVACY</h3>
              <p className="text-gray-500 text-sm leading-7 font-light group-hover:text-gray-300 transition-colors">
                Advanced mixing pools with 6-8 note splitting break transaction links. Time-based windows and multi-hop routing ensure your transfers remain private.
              </p>
            </div>

            {/* Card 2 */}
            <div className="luxury-card p-12 group mt-0 md:-mt-8">
              <div className="corner-accent tl"></div>
              <div className="corner-accent tr"></div>
              <div className="corner-accent bl"></div>
              <div className="corner-accent br"></div>
              
              <div className="h-16 w-16 mb-10 flex items-center justify-center border border-white/10 rounded-full group-hover:border-wine-500/50 transition-colors duration-500">
                <i className="fas fa-coins text-2xl text-white group-hover:text-wine-500 transition-colors"></i>
              </div>
              
              <h3 className="text-xl text-white tracking-[0.1em] mb-6 font-light serif">LOW FEES</h3>
              <p className="text-gray-500 text-sm leading-7 font-light group-hover:text-gray-300 transition-colors">
                Competitive 0.05% relayer fee with 0% deposit fees. Immutable configuration ensures fees never increase unexpectedly.
              </p>
            </div>

            {/* Card 3 */}
            <div className="luxury-card p-12 group">
              <div className="corner-accent tl"></div>
              <div className="corner-accent tr"></div>
              <div className="corner-accent bl"></div>
              <div className="corner-accent br"></div>
              
              <div className="h-16 w-16 mb-10 flex items-center justify-center border border-white/10 rounded-full group-hover:border-wine-500/50 transition-colors duration-500">
                <i className="fas fa-shield-alt text-2xl text-white group-hover:text-wine-500 transition-colors"></i>
              </div>
              
              <h3 className="text-xl text-white tracking-[0.1em] mb-6 font-light serif">TRUSTLESS</h3>
              <p className="text-gray-500 text-sm leading-7 font-light group-hover:text-gray-300 transition-colors">
                Emergency recovery system and immutable configuration. End-to-end encrypted memos ensure server cannot access your data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-20 border-t border-white/5 bg-[#010003]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-600 tracking-[0.2em] uppercase">
            <div className="mb-4 md:mb-0">Zurix © 2025</div>
            <div className="flex space-x-8">
              <a href="https://github.com/ZurixApp/Zurix" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Legal</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Zurich</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
