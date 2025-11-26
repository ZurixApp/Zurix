'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { BookOpen, Lock, Key, Shield } from 'lucide-react';
import CustomCursor from '@/components/CustomCursor';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [scrolled, setScrolled] = useState(false);
  
  // Scroll Progress Bar
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Update active section
      const sections = document.querySelectorAll('section[id]');
      const scrollPos = window.scrollY + 200;

      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        const sectionHeight = (section as HTMLElement).offsetHeight;
        const sectionId = section.getAttribute('id');

        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
          setActiveSection(sectionId || 'overview');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sections = [
    { id: 'overview', title: 'Overview' },
    { id: 'architecture', title: 'System Architecture' },
    { id: 'privacy', title: 'Privacy Mechanisms' },
    { id: 'mixing', title: 'Multi-Note Mixing Protocol' },
    { id: 'routing', title: 'Multi-Hop Routing' },
    { id: 'recovery', title: 'Emergency Recovery System' },
    { id: 'encryption', title: 'End-to-End Encryption' },
    { id: 'config', title: 'Immutable Configuration' },
    { id: 'wallet', title: 'Wallet Management' },
    { id: 'api', title: 'API Reference' },
    { id: 'security', title: 'Security Model' },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  // Section Wrapper Component
  const Section = ({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) => (
    <section 
      id={id}
      className={`scroll-mt-32 mb-24 ${className}`}
    >
      {children}
    </section>
  );

  // Luxury Card Component
  const LuxuryCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`glass-panel rounded-xl p-8 transition-all duration-300 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="antialiased min-h-screen relative">
      <CustomCursor />
      
      {/* Animated Background Elements */}
      <div className="aurora-bg"></div>
      <div className="blob-1"></div>
      <div className="blob-2"></div>

      {/* Navigation Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-wine-500 origin-left z-[60]"
        style={{ scaleX }}
      />

      {/* Navigation */}
      <nav className={`fixed w-full z-50 top-0 transition-all duration-500 border-b ${
        scrolled 
        ? 'bg-obsidian/80 backdrop-blur-xl border-white/5 py-4' 
        : 'bg-transparent border-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
          <a href="/" className="text-xl font-bold tracking-[0.3em] serif text-white z-10 flex items-center gap-4 logo-container cursor-pointer">
            <div className="swiss-cross-icon"></div>
            ZURIX
          </a>
          
          <div className="hidden md:flex space-x-8 text-[11px] tracking-[0.2em] font-medium uppercase">
            <a href="/" className="text-gray-400 hover:text-white transition-colors duration-300">Home</a>
            <a href="/docs" className="text-wine-500">Docs</a>
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

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-32 pb-20">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-32 glass-panel rounded-xl overflow-hidden p-0 border-l-0 border-r-0 border-t border-b border-white/5">
              <div className="p-4 bg-wine-900/30 border-b border-white/5">
                <h3 className="text-xs font-bold text-wine-200 tracking-[0.2em] uppercase flex items-center gap-2">
                  <BookOpen className="w-3 h-3" />
                  Contents
                </h3>
              </div>
              <nav className="p-2 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs tracking-wide transition-all duration-300 flex items-center gap-3 group ${
                      activeSection === section.id
                        ? 'bg-wine-900/40 text-wine-200 border border-wine-500/20 shadow-[0_0_15px_rgba(122,27,41,0.1)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className={`w-1 h-1 rounded-full transition-all duration-300 ${activeSection === section.id ? 'bg-wine-400 scale-150' : 'bg-gray-600 group-hover:bg-gray-400'}`}></div>
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <motion.div 
              className="mb-16 border-b border-white/10 pb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-block px-3 py-1 rounded-full bg-wine-900/30 border border-wine-500/20 text-wine-300 text-[10px] tracking-widest uppercase mb-4">
                Protocol V1.0
              </div>
              <h1 className="text-4xl md:text-6xl font-bold serif text-white mb-6 leading-tight">
                Documentation
              </h1>
              <p className="text-xl text-gray-400 leading-relaxed font-light max-w-2xl">
                Complete technical documentation for Zurix's private swap protocol, featuring advanced mixing pools and cryptographic privacy guarantees.
              </p>
              <p className="text-sm text-gray-500 mt-4 font-light">
                Contract Address: <span className="text-wine-400 font-mono">[To be deployed]</span>
              </p>
            </motion.div>

            {/* Overview */}
            <Section id="overview">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">01.</span> Overview
                </h2>
                <div className="prose prose-invert max-w-none text-gray-300 font-light">
                  <p className="leading-loose mb-8 text-lg">
                    Zurix is a privacy-focused Solana transaction protocol enabling private transfers through advanced mixing pools, multi-hop routing, and cryptographic guarantees. The system breaks transaction links between source and destination addresses while maintaining usability.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6 my-8">
                    {[
                      { title: "Mixing Pool Architecture", desc: "Decouples deposits and withdrawals to break direct links." },
                      { title: "Time-Based Windows", desc: "Groups transactions into 60s windows to increase anonymity sets." },
                      { title: "Multi-Note Splitting", desc: "Splits funds into 6-8 smaller notes with different paths." },
                      { title: "Amount Obfuscation", desc: "Adds ±0.001 SOL random adjustments to break correlation." }
                    ].map((item, i) => (
                      <div key={i} className="p-5 rounded-lg border border-white/5 bg-white/5 hover:bg-wine-900/20 transition-colors">
                        <h4 className="text-wine-400 font-medium mb-2">{item.title}</h4>
                        <p className="text-sm text-gray-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </LuxuryCard>
            </Section>

            {/* Architecture */}
            <Section id="architecture">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">02.</span> Architecture
                </h2>
                <div className="space-y-8">
                  <p className="text-gray-300 leading-relaxed">
                    The system consists of a backend service layer, wallet management service, and privacy coordination engine built on Solana.
                  </p>

                  <div className="relative border-l border-wine-900/50 pl-8 space-y-12">
                    {[
                      { step: "1", title: "Preparation", text: "Client calls API, backend generates encrypted intermediate wallet." },
                      { step: "2", title: "Deposit", text: "User sends SOL. System verifies on-chain and initiates swap." },
                      { step: "3", title: "Splitting & Mixing", text: "Amount split into 6-8 notes, assigned to 60s mixing window." },
                      { step: "4", title: "Withdrawal", text: "Delayed withdrawal with randomized amounts and multi-hop routing." }
                    ].map((flow, i) => (
                      <div key={i} className="relative">
                        <span className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-wine-900 border border-wine-500 flex items-center justify-center text-[10px] font-bold text-white z-10">
                          {flow.step}
                        </span>
                        <h4 className="text-white serif text-lg mb-2">{flow.title}</h4>
                        <p className="text-gray-400 text-sm">{flow.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-black/40 rounded border border-wine-500/20">
                    <h4 className="text-wine-300 text-sm font-bold uppercase tracking-wider mb-4">Database Schema</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-wine-500 rounded-full"></div>intermediate_wallets</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-wine-500 rounded-full"></div>swap_transactions</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-wine-500 rounded-full"></div>mixing_windows</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-wine-500 rounded-full"></div>encrypted_memos</li>
                    </ul>
                  </div>
                </div>
              </LuxuryCard>
            </Section>

            {/* Privacy */}
            <Section id="privacy">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">03.</span> Privacy Mechanisms
                </h2>
                
                <div className="space-y-6 text-gray-300">
                  <div className="p-6 rounded-lg bg-gradient-to-br from-wine-900/20 to-transparent border border-wine-500/10">
                    <h3 className="text-xl text-white serif mb-3">Mixing Pool Diagram</h3>
                    <pre className="text-xs md:text-sm text-gray-300 overflow-x-auto p-4 rounded bg-black/50 border border-white/5 font-mono">
{`Source → Deposit Pool → Mixing Window → Withdrawal Pool → Destination
  ↓           ↓              ↓                ↓              ↓
User A    Pool Entry 1   Time Window    Pool Entry 5    User B
User C    Pool Entry 2   (1 minute)     Pool Entry 3    User D
User E    Pool Entry 3                  Pool Entry 1    User A

Key: Deposit wallet ≠ Withdrawal wallet (link broken)`}
                    </pre>
                  </div>

                  <p className="leading-relaxed">
                    We utilize <strong>temporal obfuscation</strong> where a delay (10-40s) breaks timing correlation, and <strong>multi-hop routing</strong> where funds pass through 2-3 intermediate wallets with randomized delays (5-20s).
                  </p>
                </div>
              </LuxuryCard>
            </Section>

            {/* Mixing Protocol */}
            <Section id="mixing">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">04.</span> Multi-Note Protocol
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-6 rounded-lg bg-wine-900/40 border border-wine-500/20 text-center">
                    <div className="text-4xl serif text-white mb-2">6</div>
                    <div className="text-xs tracking-widest text-wine-400 uppercase">Default Notes</div>
                    <div className="text-[10px] text-gray-500 mt-2">0.5 - 1.0 SOL</div>
                  </div>
                  <div className="p-6 rounded-lg bg-wine-900/40 border border-wine-500/20 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                    </div>
                    <div className="text-4xl serif text-white mb-2">8</div>
                    <div className="text-xs tracking-widest text-wine-400 uppercase">Max Notes</div>
                    <div className="text-[10px] text-gray-500 mt-2">&gt; 1.0 SOL</div>
                  </div>
                  <div className="p-6 rounded-lg bg-wine-900/40 border border-wine-500/20 text-center">
                    <div className="text-4xl serif text-white mb-2">2</div>
                    <div className="text-xs tracking-widest text-wine-400 uppercase">Min Notes</div>
                    <div className="text-[10px] text-gray-500 mt-2">&lt; 0.1 SOL</div>
                  </div>
                </div>

                <p className="text-gray-300 mb-4">
                  The system uses the <strong>Fisher-Yates shuffle</strong> to randomize note order and varied split sizes (15-35% of remaining amount) to prevent pattern recognition.
                </p>
              </LuxuryCard>
            </Section>

            {/* Encryption & Config */}
            <Section id="encryption">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">05.</span> Security & Config
                </h2>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-wine-900/50 pb-2">Encryption</h3>
                    <ul className="space-y-3 text-sm text-gray-400">
                      <li className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-wine-500" />
                        AES-256-GCM Authenticated Encryption
                      </li>
                      <li className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-wine-500" />
                        PBKDF2 Key Derivation (100k iters)
                      </li>
                      <li className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-wine-500" />
                        Client-side only decryption
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-wine-900/50 pb-2">Immutable Config</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Relayer Fee</span>
                        <span className="text-white font-mono">0.05%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Deposit Fee</span>
                        <span className="text-white font-mono">0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Min Amount</span>
                        <span className="text-white font-mono">0.03 SOL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </LuxuryCard>
            </Section>

            {/* API Reference */}
            <Section id="api">
              <LuxuryCard>
                <h2 className="text-3xl font-bold serif text-white mb-8 flex items-center gap-3">
                  <span className="text-wine-500">06.</span> API Reference
                </h2>

                <div className="space-y-6">
                  <div className="group">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 rounded bg-green-900/30 text-green-400 text-xs font-mono border border-green-500/20">POST</span>
                      <code className="text-white text-sm">/api/swap/prepare</code>
                    </div>
                    <div className="p-4 bg-black/40 rounded border border-white/5 group-hover:border-wine-500/30 transition-colors">
                      <p className="text-gray-400 text-sm mb-3">Prepare a swap transaction and generate intermediate wallet.</p>
                      <pre className="text-xs text-gray-300 overflow-x-auto">
{`{
  "sourceWallet": "string",
  "destinationWallet": "string",
  "amount": "number"
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="group">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 rounded bg-green-900/30 text-green-400 text-xs font-mono border border-green-500/20">POST</span>
                      <code className="text-white text-sm">/api/swap/initiate</code>
                    </div>
                    <div className="p-4 bg-black/40 rounded border border-white/5 group-hover:border-wine-500/30 transition-colors">
                      <p className="text-gray-400 text-sm mb-3">Initiate swap after funding the intermediate wallet.</p>
                      <pre className="text-xs text-gray-300 overflow-x-auto">
{`{
  "sourceWallet": "string",
  "sourceTxSignature": "string",
  "intermediateWalletId": "string",
  "recoveryKey": "string"
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="group">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-400 text-xs font-mono border border-blue-500/20">GET</span>
                      <code className="text-white text-sm">/api/swap/status/:id</code>
                    </div>
                    <div className="p-4 bg-black/40 rounded border border-white/5">
                      <p className="text-gray-400 text-sm">Get transaction status and real-time progress.</p>
                    </div>
                  </div>
                </div>
              </LuxuryCard>
            </Section>

            {/* Footer */}
            <footer className="mt-20 pt-8 border-t border-white/5 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-4 h-4 bg-wine-800 rounded flex items-center justify-center">
                  <div className="swiss-cross-icon scale-50"></div>
                </div>
                <span className="text-white serif tracking-widest text-sm">ZURIX</span>
              </div>
              <p className="text-gray-500 text-xs tracking-wide">
                © {new Date().getFullYear()} Zurix Protocol. All rights reserved.
              </p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  );
}
