import { X, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { downloadFileUrl } from '../api';

const FilePreview = ({ file, onClose }) => {
    if (!file) return null;

    const isImage = file.type.startsWith('image/');
    const downloadUrl = downloadFileUrl(file.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f111a]/95 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        {isImage ? <ImageIcon className="w-5 h-5 text-cyan-400" /> : <FileText className="w-5 h-5 text-slate-400" />}
                        <h2 className="font-semibold text-slate-200 truncate max-w-md">{file.name}</h2>
                        <span className="text-xs text-slate-500 border-l border-white/10 pl-3 ml-1">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={downloadUrl}
                            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-cyan-300 transition-colors"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-400 transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-8 bg-black/20 flex items-center justify-center">
                    {isImage ? (
                        <img
                            src={`http://localhost:3001/uploads/${file.path}`}
                            alt={file.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-500">
                            <FileText className="w-24 h-24 opacity-50" />
                            <p>Preview not available for this file type.</p>
                            <a href={downloadUrl} className="text-cyan-400 hover:underline hover:text-cyan-300">Download to view</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePreview;
