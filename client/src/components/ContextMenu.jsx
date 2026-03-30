import { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, options, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed bg-[#0a0c14]/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-xl py-2 border border-white/10 z-50 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: y, left: x }}
        >
            {options.map((option, index) => (
                <button
                    key={index}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-cyan-300 flex items-center gap-3 transition-colors"
                    onClick={() => {
                        option.onClick();
                        onClose();
                    }}
                >
                    {option.icon && <option.icon className="w-4 h-4 text-slate-500 hover:text-cyan-400 transition-colors" />}
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export default ContextMenu;
