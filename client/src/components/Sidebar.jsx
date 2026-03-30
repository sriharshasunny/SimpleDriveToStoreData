import { HardDrive, Clock, Star, Trash2, Cloud } from 'lucide-react';
import { cn } from '../utils';

const Sidebar = ({ currentFilter, onFilterChange, usage = 0 }) => {
  const menuItems = [
    { id: null, label: 'My Drive', icon: HardDrive },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  // Calculate Storage
  const totalLimit = 15 * 1024 * 1024 * 1024; // 15 GB
  const percentage = Math.min((usage / totalLimit) * 100, 100);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-64 bg-[#0a0c14]/40 backdrop-blur-3xl border-r border-white/5 p-4 flex flex-col gap-2 shrink-0 hidden md:flex transition-all duration-300">
      <div className="flex items-center gap-3 px-4 py-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] transform hover:scale-110 transition-transform duration-300">
          <Cloud className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight">Drive</span>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onFilterChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden",
              currentFilter === item.id
                ? "bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.1)] translate-x-1 border border-cyan-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-cyan-200 hover:translate-x-1"
            )}
          >
            <div className={cn(
              "absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300",
              currentFilter === item.id ? "opacity-0" : "group-hover:opacity-100"
            )} />
            <item.icon className={cn(
              "w-5 h-5 relative z-10 transition-colors duration-300",
              currentFilter === item.id ? "text-cyan-300" : "text-slate-500 group-hover:text-cyan-200"
            )} />
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto px-4 py-4 backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-lg">
        <div className="w-full bg-gray-200/50 rounded-full h-1.5 mb-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all duration-500"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 font-medium">{formatSize(usage)} of 15 GB used</p>
      </div>
    </div>
  );
};

export default Sidebar;
