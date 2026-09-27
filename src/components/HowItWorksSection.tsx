import React from 'react';
import { Gamepad, Monitor, Shield, UserCheck, CreditCard, Clock, KeyRound } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      num: 1,
      icon: Gamepad,
      title: 'Choose Your Game',
      desc: 'Browse our catalog of PS4 and PS5 blockbusters priced transparently in USD.',
    },
    {
      num: 2,
      icon: Monitor,
      title: 'Select PS4 or PS5',
      desc: 'Choose your console generation to ensure compatible digital installation.',
    },
    {
      num: 3,
      icon: Shield,
      title: 'Pick Account Option',
      desc: 'Choose Primary Shared, Primary Non-Sharing, Secondary, or Full Private.',
    },
    {
      num: 4,
      icon: UserCheck,
      title: 'Enter Contact Info',
      desc: 'No account registration required. Just enter your name, email, and WhatsApp number.',
    },
    {
      num: 5,
      icon: CreditCard,
      title: 'Pay Securely in GHS',
      desc: 'Instant checkout with MTN MoMo, Telecel Cash, or cards processed via Paystack.',
    },
    {
      num: 6,
      icon: Clock,
      title: 'Fast Fulfillment (~30m)',
      desc: 'Our admin queue prepares verified account credentials and step-by-step setup guides.',
    },
    {
      num: 7,
      icon: KeyRound,
      title: 'Install & Play',
      desc: 'Access your credentials securely on your private order page and enjoy your game!',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-slate-800 text-white">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
            Simple 7-Step Process
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            How Digital PlayStation Purchasing Works
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            From picking your game to downloading it onto your console in less than 30 minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 relative hover:border-slate-700 transition-colors group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-xs">
                      0{step.num}
                    </span>
                    <Icon className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
